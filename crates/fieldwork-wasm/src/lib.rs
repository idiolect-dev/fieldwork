//! WASM bridge between the React app and `fieldwork-core`.
//!
//! Functions exported here all take and return JS values (via
//! `serde-wasm-bindgen`) so the React side never deals with raw
//! `JsValue` plumbing. The bridge is intentionally thin: every
//! exported function delegates straight into `fieldwork-core` and
//! shape-converts at the boundary.

#![warn(clippy::pedantic)]
#![allow(clippy::missing_errors_doc, clippy::module_name_repetitions)]

use fieldwork_core::{
    Draft, DraftKind, ExportEnvelope, ExportFormat, Guidance, ImportSource, Workspace,
    export::build_export_envelope, import::import_record,
};
use wasm_bindgen::prelude::*;

/// Hello-world ping the React app fires once on boot to confirm the
/// WASM bundle loaded. Useful for surfacing a clear error in the UI
/// when wasm-pack output is missing or stale.
#[wasm_bindgen]
#[must_use]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_owned()
}

/// Decode a JSON record body into a typed [`Draft`] envelope.
///
/// `kind` is the kebab-case kind tag (`dialect`, `vocab`, `community`,
/// `recommendation`, `deliberation`, `deliberation-statement`,
/// `deliberation-outcome`); `body_json` is the raw record body the
/// browser loaded from a file / at-uri / fixture; `id` and `label`
/// are browser-assigned bookkeeping.
#[wasm_bindgen(js_name = importRecord)]
pub fn import_record_js(
    kind: &str,
    body_json: JsValue,
    id: String,
    label: String,
) -> Result<JsValue, JsError> {
    let kind = parse_kind(kind)?;
    let body: serde_json::Value = serde_wasm_bindgen::from_value(body_json)
        .map_err(|e| JsError::new(&format!("body json is not a serde_json::Value: {e}")))?;
    let draft = import_record(kind, body, id, label).map_err(to_js_error)?;
    serde_wasm_bindgen::to_value(&draft)
        .map_err(|e| JsError::new(&format!("could not serialize draft: {e}")))
}

/// Compute guidance for a draft (no workspace context).
#[wasm_bindgen(js_name = guidanceFor)]
pub fn guidance_for_js(draft_json: JsValue) -> Result<JsValue, JsError> {
    let draft: Draft = serde_wasm_bindgen::from_value(draft_json)
        .map_err(|e| JsError::new(&format!("draft is not well-formed: {e}")))?;
    let guidance = Guidance::for_draft(&draft);
    serde_wasm_bindgen::to_value(&guidance)
        .map_err(|e| JsError::new(&format!("could not serialize guidance: {e}")))
}

/// Compute guidance for a draft with cross-draft consistency
/// checks. `workspace_json` is the serialized fieldwork-core
/// `Workspace`; `published_uris_json` is a `Record<draft_id,
/// at_uri>` of drafts that have already been published.
#[wasm_bindgen(js_name = guidanceForInWorkspace)]
pub fn guidance_for_in_workspace_js(
    draft_json: JsValue,
    workspace_json: JsValue,
    published_uris_json: JsValue,
) -> Result<JsValue, JsError> {
    let draft: Draft = serde_wasm_bindgen::from_value(draft_json)
        .map_err(|e| JsError::new(&format!("draft is not well-formed: {e}")))?;
    let workspace: Workspace = serde_wasm_bindgen::from_value(workspace_json)
        .map_err(|e| JsError::new(&format!("workspace is not well-formed: {e}")))?;
    let published_uris: std::collections::BTreeMap<String, String> =
        serde_wasm_bindgen::from_value(published_uris_json)
            .map_err(|e| JsError::new(&format!("published_uris is not well-formed: {e}")))?;
    let guidance = Guidance::for_draft_in_workspace(&draft, &workspace, &published_uris);
    serde_wasm_bindgen::to_value(&guidance)
        .map_err(|e| JsError::new(&format!("could not serialize guidance: {e}")))
}

/// Build an export envelope for a draft.
#[wasm_bindgen(js_name = exportDraft)]
pub fn export_draft_js(draft_json: JsValue, did: &str) -> Result<JsValue, JsError> {
    let draft: Draft = serde_wasm_bindgen::from_value(draft_json)
        .map_err(|e| JsError::new(&format!("draft is not well-formed: {e}")))?;
    let envelope: ExportEnvelope = build_export_envelope(&draft, did).map_err(to_js_error)?;
    serde_wasm_bindgen::to_value(&envelope)
        .map_err(|e| JsError::new(&format!("could not serialize envelope: {e}")))
}

/// Parse and validate an at-uri client-side, returning a structured
/// `(did, collection, rkey)` tuple as a JS object. Used by the
/// import dialog to validate user input *before* issuing the
/// `getRecord` xrpc call so a typo doesn't burn a network round-trip.
#[wasm_bindgen(js_name = parseAtUri)]
pub fn parse_at_uri_js(uri: &str) -> Result<JsValue, JsError> {
    let parsed = idiolect_records::AtUri::parse(uri)
        .map_err(|e| JsError::new(&format!("invalid at-uri: {e}")))?;
    let triple = ParsedAtUri {
        canonical: parsed.as_str().to_owned(),
    };
    serde_wasm_bindgen::to_value(&triple)
        .map_err(|e| JsError::new(&format!("could not serialize parsed at-uri: {e}")))
}

#[derive(serde::Serialize)]
struct ParsedAtUri {
    canonical: String,
}

fn parse_kind(kebab: &str) -> Result<DraftKind, JsError> {
    Ok(match kebab {
        "dialect" => DraftKind::Dialect,
        "vocab" => DraftKind::Vocab,
        "community" => DraftKind::Community,
        "recommendation" => DraftKind::Recommendation,
        "deliberation" => DraftKind::Deliberation,
        "deliberation-statement" => DraftKind::DeliberationStatement,
        "deliberation-outcome" => DraftKind::DeliberationOutcome,
        other => return Err(JsError::new(&format!("unknown draft kind: {other:?}"))),
    })
}

fn to_js_error<E: std::fmt::Display>(e: E) -> JsError {
    JsError::new(&e.to_string())
}

// `Workspace` is exposed for parity with `fieldwork-core` even
// though the React app currently keeps its own (zustand) workspace
// and only uses these for batch-load / batch-save. Expand when
// `localStorage` hydration hits a perf wall.
#[wasm_bindgen(js_name = emptyWorkspace)]
#[must_use]
///
/// # Panics
///
/// Panics only if `serde_wasm_bindgen::to_value` fails to serialize
/// an empty `Workspace`, which is a logic error in this crate's
/// dependencies; the Workspace type derives `Serialize` and an
/// empty instance has no failure modes.
pub fn empty_workspace_js() -> JsValue {
    serde_wasm_bindgen::to_value(&Workspace::new()).expect("empty workspace serializes to JsValue")
}

// Pull `ImportSource` and `ExportFormat` into the wasm crate's
// source so they show up in the wasm-bindgen-generated typescript
// declarations even though the React app uses their JSON shape, not
// the WASM ABI. The function itself is never called.
#[doc(hidden)]
#[must_use]
pub fn _types() -> (ImportSource, ExportFormat) {
    (
        ImportSource::Fixture {
            name: String::new(),
        },
        ExportFormat::RecordJson,
    )
}

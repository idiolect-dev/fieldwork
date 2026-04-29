//! Export: turn a [`Draft`] into something the user can publish.
//!
//! The two v1 export shapes are:
//!
//! - **Record JSON**; exactly the body a PDS expects under
//!   `com.atproto.repo.createRecord`. The browser triggers a file
//!   download with this content.
//! - **CLI publish command**; a copy-pasteable
//!   `idiolect cli <kind> create --did <did> --record-file …`
//!   invocation. The user runs it from their shell once the JSON is
//!   on disk.
//!
//! Both shapes flow through this single [`build_export_envelope`]
//! entry point so the WASM layer sees a consistent return type.

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::draft::Draft;

/// Pick which export shape the caller wants. The browser lets the
/// user pick from radio buttons in the export dialog.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExportFormat {
    /// Just the record body json.
    RecordJson,
    /// `idiolect-cli` create command. The render expects a
    /// `record-file` path; export pre-fills it with the suggested
    /// download filename.
    CliCommand,
}

/// Errors raised by [`build_export_envelope`].
#[derive(Debug, Error)]
pub enum ExportError {
    /// serde failed to render the record body. Should not happen for
    /// drafts the workspace already validated, but surfaced anyway
    /// so the browser can show a useful diagnostic instead of a
    /// blank download.
    #[error("could not serialize draft body: {0}")]
    Serialize(#[from] serde_json::Error),
}

/// Bundle of everything the browser needs to drive the export UI:
/// the bytes to download, the suggested filename, and the cli
/// command to copy. The browser picks which fields to use based on
/// the user's [`ExportFormat`] choice; we always populate both so
/// the user can switch without re-running the export.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportEnvelope {
    /// Record body json, indented for human readability.
    pub record_json: String,
    /// Filename suggested for the download
    /// (e.g. `dialect-d1.json`).
    pub filename: String,
    /// Copy-pasteable `idiolect-cli` create command.
    pub cli_command: String,
}

/// Build an [`ExportEnvelope`] from a [`Draft`].
///
/// `did` is the publishing DID; the user enters it in the export
/// dialog or it is pre-filled from a workspace-wide setting once
/// PDS publish lands in v0.2. Until then it appears verbatim in
/// the cli command.
///
/// # Errors
///
/// [`ExportError::Serialize`] if the draft body fails to render.
pub fn build_export_envelope(draft: &Draft, did: &str) -> Result<ExportEnvelope, ExportError> {
    let record_json = match draft {
        Draft::Dialect(d) => serde_json::to_string_pretty(&d.body)?,
        Draft::Vocab(d) => serde_json::to_string_pretty(&d.body)?,
        Draft::Community(d) => serde_json::to_string_pretty(&d.body)?,
        Draft::Recommendation(d) => serde_json::to_string_pretty(&d.body)?,
        Draft::Deliberation(d) => serde_json::to_string_pretty(&d.body)?,
        Draft::DeliberationStatement(d) => serde_json::to_string_pretty(&d.body)?,
        Draft::DeliberationOutcome(d) => serde_json::to_string_pretty(&d.body)?,
    };
    let kind = draft.kind();
    let nsid = kind.nsid();
    let filename = format!(
        "{}-{}.json",
        nsid.split('.').next_back().unwrap_or("record"),
        draft.id(),
    );
    // The cli subcommand mirrors `nsid.split('.').last()`; i.e.
    // `dialect`, `vocab`, `community`, `recommendation`. The
    // generated cli's record-create routes are kebab-case keyed on
    // the same suffix. When v0.5 of idiolect renames a route the
    // mapping moves out of here into a tool-specific override.
    let subcmd = nsid.split('.').next_back().unwrap_or("record");
    let cli_command = format!("idiolect cli {subcmd} create --did {did} --record-file {filename}");
    Ok(ExportEnvelope {
        record_json,
        filename,
        cli_command,
    })
}

//! Import: turn a JSON record body into a typed [`Draft`].
//!
//! The browser produces the JSON; by reading a file the user dropped,
//! by issuing an `app.bsky` `AppView` lookup, or by pulling a bundled
//! fixture; and hands the bytes here. This module decodes them into
//! the matching `idiolect-records` body and wraps it in a
//! [`Draft`] envelope.
//!
//! Network and file I/O live in the browser. This crate only sees
//! `&serde_json::Value` (or its serialized form).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

use crate::draft::{
    CommunityDraft, DeliberationDraft, DeliberationOutcomeDraft, DeliberationStatementDraft,
    DialectDraft, Draft, DraftKind, RecommendationDraft, VocabDraft,
};

/// Where the inbound JSON came from. Carried through to guidance so
/// the tool can render "fetched from at://… on … via …" alongside the
/// imported draft.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "source", rename_all = "kebab-case")]
pub enum ImportSource {
    /// Resolved from an at-uri. `appview` records which `AppView` base
    /// URL the resolver used (e.g. `https://public.api.bsky.app`).
    AtUri {
        /// The original at-uri the user pasted.
        uri: String,
        /// `AppView` base URL used for resolution.
        appview: String,
    },
    /// Read from a file the user dropped.
    File {
        /// File name (no path), as reported by the browser File API.
        name: String,
    },
    /// One of the bundled fixtures.
    Fixture {
        /// Fixture name (e.g. `dialect/minimal`).
        name: String,
    },
}

/// Errors raised by [`import_record`].
#[derive(Debug, Error)]
pub enum ImportError {
    /// The JSON is not valid against the lexicon for `kind`. The
    /// inner string is the serde error message; the browser surfaces
    /// it directly in the import dialog.
    #[error("record body is not a valid {kind:?}: {reason}")]
    Invalid {
        /// Kind we tried to deserialize as.
        kind: DraftKind,
        /// serde error message.
        reason: String,
    },
}

/// Decode a JSON body into a typed [`Draft`].
///
/// `id` is the workspace-assigned draft id (the WASM caller mints
/// these). `label` is the user-facing label; for kinds whose
/// lexicon includes a `name` field (Dialect, Vocab, Community) the
/// caller should pass the body's `name` so the workspace and the
/// record agree.
///
/// # Errors
///
/// [`ImportError::Invalid`] when the body fails to deserialize as
/// the requested kind. fieldwork does not attempt structural repair
///; a malformed import surfaces verbatim and the user fixes the
/// JSON or picks a different source.
pub fn import_record(
    kind: DraftKind,
    body: Value,
    id: String,
    label: String,
) -> Result<Draft, ImportError> {
    fn invalid<E: std::fmt::Display>(kind: DraftKind) -> impl FnOnce(E) -> ImportError {
        move |e| ImportError::Invalid {
            kind,
            reason: e.to_string(),
        }
    }

    Ok(match kind {
        DraftKind::Dialect => Draft::Dialect(Box::new(DialectDraft {
            id,
            label,
            body: serde_json::from_value(body).map_err(invalid(kind))?,
        })),
        DraftKind::Vocab => Draft::Vocab(Box::new(VocabDraft {
            id,
            label,
            body: serde_json::from_value(body).map_err(invalid(kind))?,
        })),
        DraftKind::Community => Draft::Community(Box::new(CommunityDraft {
            id,
            label,
            body: serde_json::from_value(body).map_err(invalid(kind))?,
        })),
        DraftKind::Recommendation => Draft::Recommendation(Box::new(RecommendationDraft {
            id,
            label,
            body: serde_json::from_value(body).map_err(invalid(kind))?,
        })),
        DraftKind::Deliberation => Draft::Deliberation(Box::new(DeliberationDraft {
            id,
            label,
            body: serde_json::from_value(body).map_err(invalid(kind))?,
        })),
        DraftKind::DeliberationStatement => {
            Draft::DeliberationStatement(Box::new(DeliberationStatementDraft {
                id,
                label,
                body: serde_json::from_value(body).map_err(invalid(kind))?,
            }))
        }
        DraftKind::DeliberationOutcome => {
            Draft::DeliberationOutcome(Box::new(DeliberationOutcomeDraft {
                id,
                label,
                body: serde_json::from_value(body).map_err(invalid(kind))?,
            }))
        }
    })
}

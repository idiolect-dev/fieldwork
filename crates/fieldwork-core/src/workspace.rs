//! In-memory workspace: the live collection of drafts the user is
//! editing across all five v1 tools.
//!
//! The workspace is a `BTreeMap<draft_id, Draft>`. The browser owns
//! a single instance and serializes it to localStorage between
//! sessions; nothing here cares about persistence; it's purely an
//! in-memory container with kind-aware lookups.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::draft::{Draft, DraftKind};

/// Errors raised by [`Workspace`] operations.
#[derive(Debug, Error)]
pub enum WorkspaceError {
    /// No draft with the given id.
    #[error("no draft with id {0:?}")]
    NotFound(String),
    /// A draft with the given id already exists.
    #[error("draft id {0:?} is already in use")]
    Duplicate(String),
}

/// A snapshot of every draft currently being edited.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Workspace {
    drafts: BTreeMap<String, Draft>,
}

impl Workspace {
    /// Construct an empty workspace.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Number of drafts in the workspace, regardless of kind.
    #[must_use]
    pub fn len(&self) -> usize {
        self.drafts.len()
    }

    /// Whether the workspace contains any drafts.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.drafts.is_empty()
    }

    /// Insert a draft, failing if its id is already taken.
    ///
    /// # Errors
    ///
    /// [`WorkspaceError::Duplicate`] when an existing draft has the
    /// same id. The caller is responsible for picking unique ids
    /// (the WASM layer assigns them as
    /// `<kind>-<rand-base32>`).
    pub fn insert(&mut self, draft: Draft) -> Result<(), WorkspaceError> {
        let id = draft.id().to_owned();
        if self.drafts.contains_key(&id) {
            return Err(WorkspaceError::Duplicate(id));
        }
        self.drafts.insert(id, draft);
        Ok(())
    }

    /// Replace an existing draft. Used by the tools when the user
    /// edits a field; every change produces a fresh `Draft` value
    /// rather than mutating in place, mirroring the wider
    /// idiolect-records "records are immutable on the wire" stance.
    ///
    /// # Errors
    ///
    /// [`WorkspaceError::NotFound`] when no draft has the given id.
    pub fn update(&mut self, draft: Draft) -> Result<(), WorkspaceError> {
        let id = draft.id().to_owned();
        if !self.drafts.contains_key(&id) {
            return Err(WorkspaceError::NotFound(id));
        }
        self.drafts.insert(id, draft);
        Ok(())
    }

    /// Remove a draft by id.
    ///
    /// # Errors
    ///
    /// [`WorkspaceError::NotFound`] when no draft has the given id.
    pub fn remove(&mut self, id: &str) -> Result<Draft, WorkspaceError> {
        self.drafts
            .remove(id)
            .ok_or_else(|| WorkspaceError::NotFound(id.to_owned()))
    }

    /// Look up a draft by id.
    #[must_use]
    pub fn get(&self, id: &str) -> Option<&Draft> {
        self.drafts.get(id)
    }

    /// Every draft, in insertion order. The btree gives a stable
    /// iteration order keyed on the draft id, which is what the
    /// sidebar wants.
    pub fn iter(&self) -> impl Iterator<Item = &Draft> {
        self.drafts.values()
    }

    /// Every draft of a given kind.
    pub fn iter_by_kind(&self, kind: DraftKind) -> impl Iterator<Item = &Draft> {
        self.drafts.values().filter(move |d| d.kind() == kind)
    }
}

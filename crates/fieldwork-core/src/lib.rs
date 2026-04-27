//! Record-draft model + serde validators for the fieldwork app.
//!
//! Every fieldwork tool produces a *draft* of an `idiolect_records`
//! record; typed JSON that conforms to one of the
//! `dev.idiolect.*` lexicons. This crate carries the shared types
//! (one [`Draft`] per record kind), the [`Workspace`] that holds the
//! drafts in memory, and the import / export entry points the WASM
//! layer exposes.
//!
//! The crate is no-std-friendly in spirit: it does no I/O, no
//! networking, no time-of-day. The browser owns those; this crate
//! owns the data shapes and their validation.

#![deny(missing_docs)]
#![warn(clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod draft;
pub mod export;
pub mod guidance;
pub mod import;
pub mod workspace;

pub use draft::{Draft, DraftKind};
pub use export::{ExportEnvelope, ExportError, ExportFormat};
pub use guidance::{Guidance, GuidanceItem};
pub use import::{ImportError, ImportSource};
pub use workspace::{Workspace, WorkspaceError};

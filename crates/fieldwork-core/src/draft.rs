//! Record-kind enum + per-kind draft envelope.
//!
//! A [`Draft`] is one of the five v1 idiolect record kinds wrapped in
//! an envelope that carries fieldwork's bookkeeping: an opaque draft
//! id (so the workspace can refer to it), a label the user picked,
//! and the underlying typed record body. Serialization is symmetric
//! with the wire-form record; drop the bookkeeping wrapper and the
//! body is exactly what a PDS expects under
//! `com.atproto.repo.createRecord`.

use idiolect_records::{
    Community, Deliberation, DeliberationOutcome, DeliberationStatement, Dialect, Recommendation,
    Vocab,
};
use serde::{Deserialize, Serialize};

/// The record kinds fieldwork edits.
///
/// `LexiconView` does not have a corresponding `Draft` variant; the
/// Lexicon Browser is read-only, so its state is represented in the
/// browser store rather than as a workspace draft.
///
/// `DeliberationVote` is intentionally absent: votes are real-time
/// participant actions, not authored governance records, and live
/// in client UIs rather than fieldwork's drafting surface.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DraftKind {
    /// `dev.idiolect.dialect`.
    Dialect,
    /// `dev.idiolect.vocab` (legacy action tree or new graph shape).
    Vocab,
    /// `dev.idiolect.community`.
    Community,
    /// `dev.idiolect.recommendation`.
    Recommendation,
    /// `dev.idiolect.deliberation` (community-scoped question or
    /// proposal under collective consideration).
    Deliberation,
    /// `dev.idiolect.deliberationStatement` (a participant utterance
    /// attached to a deliberation; typically a seed statement
    /// authored by the community organiser).
    DeliberationStatement,
    /// `dev.idiolect.deliberationOutcome` (observer-published tally
    /// for a closed deliberation; advanced surface).
    DeliberationOutcome,
}

impl DraftKind {
    /// The canonical NSID for the kind.
    #[must_use]
    pub const fn nsid(self) -> &'static str {
        match self {
            Self::Dialect => "dev.idiolect.dialect",
            Self::Vocab => "dev.idiolect.vocab",
            Self::Community => "dev.idiolect.community",
            Self::Recommendation => "dev.idiolect.recommendation",
            Self::Deliberation => "dev.idiolect.deliberation",
            Self::DeliberationStatement => "dev.idiolect.deliberationStatement",
            Self::DeliberationOutcome => "dev.idiolect.deliberationOutcome",
        }
    }

    /// All kinds in declaration order. Useful for menu enumeration.
    #[must_use]
    pub const fn all() -> &'static [Self] {
        &[
            Self::Dialect,
            Self::Vocab,
            Self::Community,
            Self::Recommendation,
            Self::Deliberation,
            Self::DeliberationStatement,
            Self::DeliberationOutcome,
        ]
    }
}

/// A typed record body wrapped in fieldwork bookkeeping.
///
/// The draft id is an opaque string the workspace assigns; it is not
/// the at-uri of the record (drafts have no at-uri until they are
/// published). The user-facing label is whatever string the user
/// typed in the tool's "name" / "label" field (it's mirrored into
/// the record body where the lexicon has a `name` field, but we
/// keep it on the envelope for tools that don't surface a label).
///
/// The body envelopes are boxed because `Recommendation` is
/// substantially larger than the other variants (it carries a lens
/// path and a condition tree), and clippy's `large_enum_variant`
/// rule would otherwise flag the size disparity. Boxing keeps the
/// enum payload uniform without any caller-visible cost; every
/// match arm already destructures through a reference.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "body", rename_all = "kebab-case")]
pub enum Draft {
    /// Dialect record draft.
    Dialect(Box<DialectDraft>),
    /// Vocabulary record draft.
    Vocab(Box<VocabDraft>),
    /// Community record draft.
    Community(Box<CommunityDraft>),
    /// Recommendation record draft.
    Recommendation(Box<RecommendationDraft>),
    /// Deliberation record draft.
    Deliberation(Box<DeliberationDraft>),
    /// Deliberation statement record draft (typically a seed
    /// statement an organiser pre-loads onto a deliberation).
    DeliberationStatement(Box<DeliberationStatementDraft>),
    /// Deliberation outcome record draft (observer-style tally; an
    /// advanced surface for hand-authored outcomes).
    DeliberationOutcome(Box<DeliberationOutcomeDraft>),
}

impl Draft {
    /// Kind tag, matching the variant.
    #[must_use]
    pub const fn kind(&self) -> DraftKind {
        match self {
            Self::Dialect(_) => DraftKind::Dialect,
            Self::Vocab(_) => DraftKind::Vocab,
            Self::Community(_) => DraftKind::Community,
            Self::Recommendation(_) => DraftKind::Recommendation,
            Self::Deliberation(_) => DraftKind::Deliberation,
            Self::DeliberationStatement(_) => DraftKind::DeliberationStatement,
            Self::DeliberationOutcome(_) => DraftKind::DeliberationOutcome,
        }
    }

    /// The fieldwork-assigned draft id (stable for the lifetime of a
    /// workspace session; not a PDS at-uri).
    #[must_use]
    pub fn id(&self) -> &str {
        match self {
            Self::Dialect(d) => &d.id,
            Self::Vocab(d) => &d.id,
            Self::Community(d) => &d.id,
            Self::Recommendation(d) => &d.id,
            Self::Deliberation(d) => &d.id,
            Self::DeliberationStatement(d) => &d.id,
            Self::DeliberationOutcome(d) => &d.id,
        }
    }

    /// User-facing label.
    #[must_use]
    pub fn label(&self) -> &str {
        match self {
            Self::Dialect(d) => &d.label,
            Self::Vocab(d) => &d.label,
            Self::Community(d) => &d.label,
            Self::Recommendation(d) => &d.label,
            Self::Deliberation(d) => &d.label,
            Self::DeliberationStatement(d) => &d.label,
            Self::DeliberationOutcome(d) => &d.label,
        }
    }
}

// One envelope per record kind. The body field types come straight
// from `idiolect-records`'s generated types so a draft serializes
// to/from a PDS record body byte-for-byte.

/// `dev.idiolect.dialect` draft envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DialectDraft {
    /// Workspace-assigned draft id.
    pub id: String,
    /// User-facing label (mirrors `body.name`).
    pub label: String,
    /// The record body, ready to publish as-is.
    pub body: Dialect,
}

/// `dev.idiolect.vocab` draft envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VocabDraft {
    /// Workspace-assigned draft id.
    pub id: String,
    /// User-facing label (mirrors `body.name`).
    pub label: String,
    /// The record body.
    pub body: Vocab,
}

/// `dev.idiolect.community` draft envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommunityDraft {
    /// Workspace-assigned draft id.
    pub id: String,
    /// User-facing label (mirrors `body.name`).
    pub label: String,
    /// The record body.
    pub body: Community,
}

/// `dev.idiolect.recommendation` draft envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationDraft {
    /// Workspace-assigned draft id.
    pub id: String,
    /// User-facing label (Recommendation has no `name` field, so the
    /// label is fieldwork-only; used in the workspace sidebar).
    pub label: String,
    /// The record body.
    pub body: Recommendation,
}

/// `dev.idiolect.deliberation` draft envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliberationDraft {
    /// Workspace-assigned draft id.
    pub id: String,
    /// User-facing label (mirrors `body.topic`).
    pub label: String,
    /// The record body.
    pub body: Deliberation,
}

/// `dev.idiolect.deliberationStatement` draft envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliberationStatementDraft {
    /// Workspace-assigned draft id.
    pub id: String,
    /// User-facing label (DeliberationStatement has no `name` field;
    /// the label is fieldwork-only).
    pub label: String,
    /// The record body.
    pub body: DeliberationStatement,
}

/// `dev.idiolect.deliberationOutcome` draft envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliberationOutcomeDraft {
    /// Workspace-assigned draft id.
    pub id: String,
    /// User-facing label (DeliberationOutcome has no `name` field;
    /// the label is fieldwork-only).
    pub label: String,
    /// The record body.
    pub body: DeliberationOutcome,
}

//! Per-draft guidance bullets.
//!
//! The browser shows a "Guidance" pane next to every tool. The pane
//! answers two questions for the current draft:
//!
//! 1. **Who consumes this?**; which subscribers index it, which
//!    observation methods aggregate over it, which other record
//!    kinds will reference it once published.
//! 2. **What's still missing?**; fields the lexicon allows but the
//!    user hasn't filled in, where filling them in unblocks downstream
//!    consumers.
//!
//! Guidance is computed deterministically from a [`Draft`] alone.
//! No network calls, no time-of-day. The browser re-runs it after
//! every edit so the pane updates in lockstep.

use serde::{Deserialize, Serialize};

use crate::draft::{Draft, DraftKind};
use crate::workspace::Workspace;

/// One line item in the guidance pane. The browser groups items by
/// `severity` and renders the body as plain text (no markdown to
/// render means no XSS to worry about).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuidanceItem {
    /// What kind of nudge this is; info, hint, or warning.
    pub severity: GuidanceSeverity,
    /// Short headline (≤ 64 chars; rendered bold).
    pub headline: String,
    /// One- or two-sentence body.
    pub detail: String,
}

/// Severity buckets the browser's guidance pane uses to colour-code
/// items.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum GuidanceSeverity {
    /// "Here's what publishing this record will do downstream."
    Info,
    /// "You can add this and it will unblock X."
    Hint,
    /// "If you publish as-is, X will break."
    Warning,
}

/// Bundle of guidance items for one draft.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Guidance {
    /// Items in order of relevance (most actionable first).
    pub items: Vec<GuidanceItem>,
}

impl Guidance {
    /// Compute guidance for a draft.
    ///
    /// The result is intentionally terse; fieldwork's tools each
    /// own a richer per-tool guidance render and call this for the
    /// "downstream consumers" half of the pane.
    #[must_use]
    pub fn for_draft(draft: &Draft) -> Self {
        let mut items = Vec::new();
        items.extend(downstream_consumers(draft));
        items.extend(missing_fields(draft));
        Self { items }
    }

    /// Same as [`Guidance::for_draft`] plus cross-draft consistency
    /// checks against `workspace`. Walks the at-uri references in
    /// `draft` and flags ones that point at a different draft's
    /// id-shaped slot, so the user can see when a recommendation's
    /// `issuingCommunity` matches a draft community in the same
    /// workspace (cross-link), or doesn't match any of them
    /// (potentially-typo'd at-uri).
    ///
    /// `published_uris` is the optional map of draft-id →
    /// at-uri-after-publish. Once a draft has been published the
    /// browser stores its at-uri here and this function uses it to
    /// match references against published drafts.
    #[must_use]
    pub fn for_draft_in_workspace(
        draft: &Draft,
        workspace: &Workspace,
        published_uris: &std::collections::BTreeMap<String, String>,
    ) -> Self {
        let mut items = Vec::new();
        items.extend(downstream_consumers(draft));
        items.extend(missing_fields(draft));
        items.extend(cross_draft_references(draft, workspace, published_uris));
        Self { items }
    }
}

fn cross_draft_references(
    draft: &Draft,
    workspace: &Workspace,
    published_uris: &std::collections::BTreeMap<String, String>,
) -> Vec<GuidanceItem> {
    // Collect published at-uris. Drafts that haven't been published
    // yet have no at-uri; we still list them so the cross-link
    // suggestion can name them by id.
    let community_uris: Vec<(&str, &str)> = workspace
        .iter_by_kind(DraftKind::Community)
        .filter_map(|d| {
            let id = d.id();
            let label = d.label();
            published_uris.get(id).map(|uri| (uri.as_str(), label))
        })
        .collect();

    let mut items = Vec::new();
    let referenced_community = match draft {
        Draft::Dialect(d) => Some(d.body.owning_community.as_str()),
        Draft::Recommendation(d) => Some(d.body.issuing_community.as_str()),
        _ => None,
    };

    if let Some(uri) = referenced_community {
        // Match the at-uri against any published community in the
        // workspace. If a match: confirm the cross-link. If not:
        // and a workspace community exists with no published uri
        // yet, suggest publishing it first.
        let cross_match = community_uris
            .iter()
            .find(|(published, _)| *published == uri);
        if let Some((_, label)) = cross_match {
            items.push(GuidanceItem {
                severity: GuidanceSeverity::Info,
                headline: "Cross-links to a workspace community".into(),
                detail: format!(
                    "References {label:?} in the workspace. The orchestrator's \
                     queries will treat this draft as part of {label:?}'s \
                     federation surface."
                ),
            });
        } else {
            // Did the user *probably* mean to reference a workspace
            // community whose at-uri isn't known yet (because the
            // community draft hasn't been published)?
            let unpublished = workspace
                .iter_by_kind(DraftKind::Community)
                .filter(|d| !published_uris.contains_key(d.id()))
                .count();
            if unpublished > 0 && !uri.is_empty() {
                items.push(GuidanceItem {
                    severity: GuidanceSeverity::Hint,
                    headline: "References a community at-uri".into(),
                    detail: format!(
                        "{unpublished} community draft(s) in the workspace \
                         have no published at-uri yet. If this draft \
                         should reference one of them, publish the \
                         community first and update this field with the \
                         resulting at-uri."
                    ),
                });
            }
        }
    }
    items
}

fn downstream_consumers(draft: &Draft) -> Vec<GuidanceItem> {
    match draft.kind() {
        DraftKind::Dialect => vec![GuidanceItem {
            severity: GuidanceSeverity::Info,
            headline: "Dialect indexers will pick this up".into(),
            detail: "Once published, any subscriber tracking your owning \
                     community's dialect-federation observation will see \
                     this dialect's preferred-lens set diff against the \
                     prior version. Dialect records are subsumed by \
                     `supersedes` chains, so a published draft will \
                     replace the previous head."
                .into(),
        }],
        DraftKind::Vocab => vec![GuidanceItem {
            severity: GuidanceSeverity::Info,
            headline: "Vocabularies are referenced by encounters".into(),
            detail: "Once published, encounter records can name your \
                     at-uri in `use.actionVocabulary` or \
                     `use.purposeVocabulary` to ground their action / \
                     purpose strings. The action-distribution and \
                     purpose-distribution observations roll up encounter \
                     counts under your hierarchy when the world \
                     discipline is hierarchy-closed or closed-with-default."
                .into(),
        }],
        DraftKind::Community => vec![GuidanceItem {
            severity: GuidanceSeverity::Info,
            headline: "Communities scope recommendations and dialects".into(),
            detail: "Once published, dialect records can name your \
                     community as `owningCommunity` and recommendation \
                     records as `issuingCommunity`. Member DIDs gate \
                     `IS_MEMBER_OF` predicate evaluation in eligibility \
                     trees."
                .into(),
        }],
        DraftKind::Recommendation => vec![GuidanceItem {
            severity: GuidanceSeverity::Info,
            headline: "Recommendations drive lens-path orchestration".into(),
            detail: "Once published, the orchestrator's \
                     `recommendations_for_path` query surfaces this \
                     recommendation when a caller's source / target \
                     schema pair matches the issuing community's \
                     condition tree. The `requiredVerifications` block \
                     filters which lens versions count as fulfilling \
                     the recommendation."
                .into(),
        }],
        DraftKind::Deliberation => vec![GuidanceItem {
            severity: GuidanceSeverity::Info,
            headline: "Deliberations open community decisions".into(),
            detail: "Once published, member clients can attach \
                     statements (`dev.idiolect.deliberationStatement`) \
                     and votes (`dev.idiolect.deliberationVote`) to this \
                     deliberation by strong-ref. The \
                     `deliberation-tally` observer folds the vote \
                     stream into per-statement counts and publishes a \
                     `deliberationOutcome` once the deliberation \
                     closes."
                .into(),
        }],
        DraftKind::DeliberationStatement => vec![GuidanceItem {
            severity: GuidanceSeverity::Info,
            headline: "Seed statements bootstrap the deliberation".into(),
            detail: "Statements pre-loaded onto a deliberation give \
                     voters something to react to without waiting for \
                     organic submissions. Set `anonymous: true` and \
                     publish under a service DID when seed statements \
                     should not carry a participant identity."
                .into(),
        }],
        DraftKind::DeliberationOutcome => vec![GuidanceItem {
            severity: GuidanceSeverity::Info,
            headline: "Outcomes summarise a closed deliberation".into(),
            detail: "Outcome records are normally observer-published \
                     by folding the vote stream. Hand-authoring one \
                     overrides the observer's view; downstream \
                     consumers select among multiple outcomes by \
                     `computedAt`."
                .into(),
        }],
    }
}

fn missing_fields(draft: &Draft) -> Vec<GuidanceItem> {
    // Per-kind suggestion of optional-but-load-bearing fields.
    // Keep these in sync with the lexicon's optional surface; the
    // tool form already enforces required fields.
    match draft {
        Draft::Dialect(d) => {
            let mut out = Vec::new();
            if d.body.preferred_lenses.as_ref().is_none_or(Vec::is_empty) {
                out.push(GuidanceItem {
                    severity: GuidanceSeverity::Hint,
                    headline: "No preferred lenses yet".into(),
                    detail: "A dialect with an empty `preferredLenses` set is \
                             well-formed but inert. Add at least one lens \
                             at-uri so subscribers picking up this dialect \
                             have something to invoke."
                        .into(),
                });
            }
            if d.body.deprecations.is_none() {
                out.push(GuidanceItem {
                    severity: GuidanceSeverity::Hint,
                    headline: "Mark superseded lenses as deprecated".into(),
                    detail: "If this dialect replaces an earlier one, list \
                             the at-uris of lenses you're moving away from \
                             in `deprecations`. Subscribers honour the list \
                             and warn when an encounter still cites a \
                             deprecated lens."
                        .into(),
                });
            }
            out
        }
        Draft::Vocab(d) => {
            let actions_empty = d.body.actions.as_ref().is_none_or(Vec::is_empty);
            let nodes_empty = d.body.nodes.as_ref().is_none_or(Vec::is_empty);
            if actions_empty && nodes_empty {
                vec![GuidanceItem {
                    severity: GuidanceSeverity::Warning,
                    headline: "Vocabulary has no entries".into(),
                    detail: "Both the legacy `actions` tree and the \
                             new `nodes` graph are empty. Add at least \
                             one entry: a `top` action plus its leaves \
                             for the tree shape, or a set of typed \
                             nodes (`concept` / `relation` / `instance` \
                             / `type` / `collection`) plus connecting \
                             edges for the graph shape."
                        .into(),
                }]
            } else {
                Vec::new()
            }
        }
        Draft::Community(d) => {
            let mut out = Vec::new();
            if d.body.members.as_ref().is_none_or(Vec::is_empty) {
                out.push(GuidanceItem {
                    severity: GuidanceSeverity::Hint,
                    headline: "No members listed".into(),
                    detail: "Communities without an explicit member list \
                             still work; eligibility predicates that ask \
                             for `IS_MEMBER_OF` will simply hold for \
                             nobody. Add member DIDs once the community \
                             coalesces, or set `membershipRoll` to point \
                             at an external roster record."
                        .into(),
                });
            }
            if d.body.record_hosting.is_none() {
                out.push(GuidanceItem {
                    severity: GuidanceSeverity::Hint,
                    headline: "Declare where this community's records live".into(),
                    detail: "Set `recordHosting` to `member-hosted` \
                             (records on member PDSes; the default), \
                             `community-hosted` (records on a community \
                             AppView, Acorn-style; pair with \
                             `appviewEndpoint`), or `hybrid` (both). \
                             Consumers crawling for community records \
                             use this to choose a surface."
                        .into(),
                });
            }
            out
        }
        Draft::Recommendation(d) => {
            let mut out = Vec::new();
            if d.body.lens_path.is_empty() {
                out.push(GuidanceItem {
                    severity: GuidanceSeverity::Warning,
                    headline: "Recommendation has no lens path".into(),
                    detail: "A recommendation needs at least one lens \
                             at-uri in `lensPath`. The orchestrator's \
                             query treats an empty path as 'recommend \
                             nothing'."
                        .into(),
                });
            }
            if d.body.required_verifications.is_none() {
                out.push(GuidanceItem {
                    severity: GuidanceSeverity::Hint,
                    headline: "No required verifications declared".into(),
                    detail: "A recommendation without a \
                             `requiredVerifications` block tells the \
                             orchestrator any lens version will do. \
                             Adding e.g. `roundtrip-test` raises the bar \
                             and lets `sufficient_verifications_for` \
                             filter out lenses that haven't been verified."
                        .into(),
                });
            }
            out
        }
        Draft::Deliberation(d) => {
            let mut out = Vec::new();
            if d.body.classification.is_none() {
                out.push(GuidanceItem {
                    severity: GuidanceSeverity::Hint,
                    headline: "No classification declared".into(),
                    detail: "Setting `classification` (e.g. `question` / \
                             `proposal` / `grievance` / `retrospective`) \
                             lets readers and observers fold votes per \
                             argumentative role. Communities running \
                             richer typologies override the default \
                             vocabulary via `classificationVocab`."
                        .into(),
                });
            }
            if d.body.status.is_none() {
                out.push(GuidanceItem {
                    severity: GuidanceSeverity::Hint,
                    headline: "Deliberation has no status".into(),
                    detail: "Set `status` to `open` for active \
                             deliberation. Use `tabled`, `adopted`, or \
                             `rejected` once it closes; observer tallies \
                             also key off this for outcome publication."
                        .into(),
                });
            }
            out
        }
        Draft::DeliberationStatement(d) => {
            let mut out = Vec::new();
            if d.body.classification.is_none() {
                out.push(GuidanceItem {
                    severity: GuidanceSeverity::Hint,
                    headline: "No statement classification".into(),
                    detail: "Tagging a statement as `claim` / \
                             `proposal` / `dissent` / `clarification` / \
                             `question` lets observers segment vote \
                             tallies by argumentative role."
                        .into(),
                });
            }
            out
        }
        Draft::DeliberationOutcome(d) => {
            let mut out = Vec::new();
            if d.body.statement_tallies.is_empty() {
                out.push(GuidanceItem {
                    severity: GuidanceSeverity::Warning,
                    headline: "Outcome has no statement tallies".into(),
                    detail: "An outcome with empty `statementTallies` \
                             carries no information. Either let an \
                             observer publish the outcome (preferred) \
                             or fill in the per-statement vote counts \
                             before publishing this draft."
                        .into(),
                });
            }
            out
        }
    }
}

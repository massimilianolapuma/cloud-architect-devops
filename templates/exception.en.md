---
doc_type: exception
id: exc-0000              # exc- and four digits, unique across all records; the file is named <id>.md
title: Short description of the deviation
guideline: SECTION/CHAPTER and the rule, quoted until rules have identifiers
scope: A class of system, for example "the database tier of one workload"
category: waiver          # waiver or mitigated
status: proposed          # proposed, approved, rejected, withdrawn, closed, replaced
requested_by: Name of the requester
requested_on: 2026-01-01
approved_by:              # filled in by the approver
approved_on:              # filled in by the approver
expires: 2026-07-01       # mandatory; at most 6 months after approved_on
replaces:                 # for a renewal: the id of the record it replaces
restricted_ref:           # optional: this record's id in the private repository, never a URL
---

_Guidance: save as `website/docs/exceptions/<section>/<chapter>/<id>.md`, where `<section>/<chapter>` is the path of the chapter whose rule is relaxed (for example `00-foundations/docs-as-code`), and start `guideline` with that same path. Write only what the governance chapter's "What a record may contain" allows: the repository is public. Every frontmatter key stays, even when empty. `approved_by` and `approved_on` are filled in by the approver, and are required once `status` is `approved`, `closed` or `replaced`. Delete every "_Guidance:" line before publishing. Keep the five H2 headings below verbatim._

## Reason

_Guidance: why the rule cannot be met, at the level of the guideline. No system, tenant, customer or resource names._

## Risk

_Guidance: the risk of granting the exception, and the risk of refusing it._

## Compensating control

_Guidance: what reduces the risk while the exception is active._

## Plan to comply

_Guidance: what will be done to meet the rule before the expiry date._

## Platform objects

_Guidance: the kind of each platform object that enforces this exception (for example an Azure Policy exemption or a Kyverno `PolicyException`), and the generic steps to remove it. No identifiers: those go to the private repository._

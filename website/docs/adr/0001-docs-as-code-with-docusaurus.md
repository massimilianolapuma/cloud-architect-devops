---
doc_type: adr
title: Documentation as code with Docusaurus, English canonical and Italian translated
status: proposed
date: 2026-11-14
deciders: Massimiliano La Puma
---

# ADR 0001: Documentation as code with Docusaurus, English canonical and Italian translated

## Context and Problem Statement

These guidelines are read by architects who decide, delivery teams who copy and stakeholders who need to understand. They must exist in English and Italian, changes must be reviewable, pages must carry architecture diagrams, Mermaid diagrams and interactive step-through diagrams, and automated checks should be able to stop a broken page from being published. The guidelines cover Azure, Google Cloud and on-prem platforms. The question is where the content lives, which tool builds and publishes it and which language is the source; this repository already builds its site with one of the candidate tools.

## Decision Drivers

The weights come from the comparison in the [chapter this record supports](../00-foundations/docs-as-code.mdx), section "Weighted matrix", and sum to 100. They are the author's judgment and await the decider's confirmation. Each driver traces to the project brief or specification; for review and audit, automated checks and continuity, the chapter's table of criteria says where the author applies a stated need beyond its own wording.

- Review and audit trail for every change (15).
- English and Italian from one content tree, with stale translations detected before publication (20).
- Automated checks that can stop publication: broken internal links and the project's own checks (20). The project specification requires `task verify`, which builds the site in both languages with no broken links, to pass before a phase is closed; the author applies that requirement to publication.
- Interactive components and diagrams inside pages: step-through diagrams, Mermaid, SVG exports of draw.io sources (15).
- Readers who do not author can read without a role on the authoring tool; people who do not use git can contribute (10).
- Continuity of the tool and cost of moving the content out (10).
- Running on the organisation's own infrastructure and without Internet access (5).
- Versioned guidelines, which the decider defined on 2026-11-13 as git history and tags, with no published version selector (5).

## Considered Options

- Docusaurus in git, English canonical, Italian translated and checked by a parity gate, published on GitHub Pages
- Hugo with the Docsy theme in git
- Antora in git
- Material for MkDocs in git
- Markdown rendered by GitHub (GitHub Enterprise Cloud), with no site build
- Azure DevOps Services wiki published as code
- Confluence Cloud (Premium plan)
- SharePoint Online (pages and document libraries)
- SharePoint Server Subscription Edition

## Decision Outcome

Chosen option: "Docusaurus in git, English canonical, Italian translated and checked by a parity gate, published on GitHub Pages", because the decider chose it: it is already in use in this repository and, in the decider's judgment, it meets the stated needs. The alternatives were examined; none was shown to be better on the evidence.

The judgment that the stated needs are met is the decider's reason. What the evidence shows, need by need, is narrower:

- Review and audit trail: the audit trail comes from git on GitHub, not from Docusaurus; whether a pull-request review can be made required is not in the research, and nothing enforces review today.
- English and Italian: one content tree with a path per locale is a Docusaurus feature. Stale translations are not detected by Docusaurus; this repository's parity check is written to report them. Its unit tests for the stale case passed on 2026-11-14 (`task test:tools`); the check has not yet reported a stale page of this site.
- Automated checks: broken internal links fail a production build by default, and Markdown file links fail by a setting this repository uses; anchors only warn and external URLs are not documented. Required status checks that stop a merge are a GitHub feature, not a Docusaurus one, and are not wired yet.
- Components and diagrams: React components and Mermaid are Docusaurus features; SVG images in pages have no research finding.
- Reach: partly met. Readers of a private GitHub Pages site need read access to the repository, which is a role on the authoring tool; otherwise the site is public. That part is settled, and the hosting chapter decides between the two. Whether those readers also need a licence is not documented. Contributing through git and pull requests is available; the research names no other route with a review step, and an editor of Docusaurus's own has no research finding.
- Continuity and exit: partly met. The end of the 3.x line is announced; GitHub's lifecycle has no finding. Two research lanes conclude that MDX pages with components would need rewriting to move.
- Own infrastructure and offline: not met as published, because GitHub Pages serves the site; whether the build runs without Internet access is not established.
- Versioned: met by git history and tags, not by Docusaurus.

Decided by the decider on 2026-11-13, and recorded here as decided:

- The organisation's forge is GitHub Enterprise Cloud. The checks run locally for now; enforcing them on the forge is wired in the delivery phase.
- The site is published on GitHub Pages. Reader access, limits and alternatives on Azure, Google Cloud and on-prem are left to a later hosting chapter with its own decision record.
- "Versioned" means git history and tags. No published version selector.
- The gaps in the link check are documented in the chapter, and any fix is a separate follow-up. The gaps are: broken anchors only warn, and external URLs are treated as unchecked. The decision names external URLs as not checked; the research does not establish whether Docusaurus checks them (see Consequences), and no local test settled it.
- Site search is later work, not part of this decision.
- The chapter that supports this record is an MDX page with one interactive flow.
- Until the Italian translation of this record exists, `task i18n:check` reports it as missing; this is accepted for the pilot.

What the evidence says about the alternatives. The chapter's comparison scores an option on research findings and, in a few stated cases, on a definition of what the option is (for example, a site served by a vendor's service is not on the organisation's own infrastructure); a level set by definition is not a researched fact about the product. This repository's own setup is not scored: the Docusaurus row is the tool published on GitHub Pages, without this repository's parity gate. Each criterion has two sub-needs, except versioning, which has one; a sub-need that no finding settles keeps its full range instead of a guess. Every generator is scored as published on GitHub Pages from GitHub Enterprise Cloud, the decided context. Each option therefore has a floor (every open point against it) and a ceiling (every open point in its favour), under the chapter's weights.

An option is totalled only when its coverage is more than half of the weight. Coverage is the weight of the criteria on which a finding or a definition narrows the option's score below the full range. Seven of the nine options pass, with a coverage of 80 or more. Confluence Cloud and SharePoint Server Subscription Edition do not: for neither does a finding set a level on two languages, on automated checks or on components and diagrams, which carry 55 of the 100 points, so their coverage is 45 and they have no totals. The threshold is the author's judgment.

| Option | Coverage | Floor | Ceiling |
|---|---|---|---|
| Docusaurus, published on GitHub Pages | 100 | 360 | 425 |
| Hugo with Docsy, published on GitHub Pages | 100 | 305 | 475 |
| Antora, published on GitHub Pages | 80 | 270 | 475 |
| Material for MkDocs, published on GitHub Pages | 100 | 320 | 445 |
| Markdown rendered by GitHub | 80 | 280 | 460 |
| Azure DevOps Services wiki published as code | 80 | 305 | 410 |
| SharePoint Online | 85 | 250 | 470 |
| Confluence Cloud (Premium) | 45 | not totalled | not totalled |
| SharePoint Server Subscription Edition | 45 | not totalled | not totalled |

- The range of each of the six totalled alternatives overlaps the Docusaurus range. Compared criterion by criterion with Docusaurus, the total difference of each of the six runs from below zero to above zero, both under the chapter's weights and under equal weights: on this evidence none of the six is shown to be better than Docusaurus, and none is shown to be worse.
- For Hugo with Docsy, Antora, Material for MkDocs and Markdown rendered by GitHub this holds for any choice of weights: on every criterion the difference from Docusaurus includes zero. On some criteria it can go only one way: Docusaurus is not lower than Hugo with Docsy, Antora or Markdown rendered by GitHub on automated checks, not lower than Markdown rendered by GitHub on reach and on own infrastructure, and not higher than it on continuity. For the other two, some weights would separate them. The settled directions are: the Azure DevOps wiki is lower than Docusaurus on automated checks and on components and diagrams; SharePoint Online is lower on versioning. On reach SharePoint Online is not lower than Docusaurus, and whether it is higher is open.
- The two options without totals can be compared with Docusaurus only on the criteria where they have findings. Confluence Cloud is higher on reach, a result that rests on an Atlassian article flagged as requiring fixes, and lower on versioning. SharePoint Server Subscription Edition is higher on own infrastructure and lower on versioning. On two languages, automated checks, and components and diagrams, nothing can be said about either.
- On reach, the Docusaurus score is settled in its first half: a private GitHub Pages site is readable only with read access to the repository, which is a role on the authoring tool, and otherwise the site is public. Whether such readers also need a licence is not documented and does not change the score.
- If the research lanes' conclusion that MDX pages would need rewriting were scored, the Docusaurus ceiling would fall from 425 to 415; the comparison does not score it, because it is the lanes' analysis, not a finding.
- The open points of Docusaurus itself are: whether a pull-request review can be made required on GitHub, SVG images in pages (no research finding), whether Docusaurus offers editing of its own for people who do not use git, the lifecycle of GitHub Enterprise Cloud and GitHub Pages (the 3.x line's end is announced), whether another tool can read its MDX pages as they are, and building without Internet access. The open points of each alternative are listed under Pros and Cons of the Options below and, cell by cell, in the chapter.
- The cost of rebuilding the existing site on another tool is not measured.

English is the only source. The Italian files mirror the English paths; each carries a hash of the English file it was translated from, and this repository's check reports an Italian file that is missing, orphaned or stale. This follows the practice of Microsoft's documentation: the PowerShell documentation says ["All translations start from the English content first"](https://learn.microsoft.com/powershell/scripting/community/contributing/get-started-writing?view=powershell-7.6), and the Dynamics 365 contributor guide accepts pull requests [only on the English source files](https://learn.microsoft.com/dynamics365/fin-ops-core/dev-itpro/help/contributor-guide).

### Consequences

Of the costs below, four rest on the decider's decisions of 2026-11-13: the failing `task i18n:check` (accepted for the pilot), the partial link check (documented in the chapter, fix later), checks that run only on a workstation for now, and search as later work. Reader access to the site, the published limits of GitHub Pages and own infrastructure on GitHub Pages are not accepted here: they are open points for the hosting chapter. Every other cost is a consequence that the decider accepts by accepting this record.

- Good, because the guidelines live in git, so changes can be reviewed and traced like code. Google reports that moving its wiki documentation under source control and code review is what made it improve ([Software Engineering at Google, chapter 10](https://abseil.io/resources/swe-book/html/ch10.html)), and the Azure Well-Architected Framework asks to ["Use unified source control for all code, scripts, deployment templates, pipeline definitions, and related documentation"](https://learn.microsoft.com/azure/well-architected/operational-excellence/principles). Nothing enforces review today (see below).
- Good, because both languages come from one tree: translated files sit under `website/i18n/`, and each locale is built as its own single-page application with its own path ([i18n introduction](https://docusaurus.io/docs/i18n/introduction), [i18n tutorial](https://docusaurus.io/docs/i18n/tutorial)).
- Good, because pages can render React components through MDX ([MDX and React](https://docusaurus.io/docs/markdown-features/react)) and Mermaid through the official theme ([Diagrams](https://docusaurus.io/docs/markdown-features/diagrams)).
- Good, because a production build fails on broken internal links by default, and Markdown file links can be made to fail by a setting, which this repository uses ([docusaurus.config.js](https://docusaurus.io/docs/api/docusaurus-config)).
- Good, because the output is plain static files: ["The only responsibility of Docusaurus is to build your site and emit static files in `build`"](https://docusaurus.io/docs/deployment).
- Good, because Docusaurus is [MIT-licensed](https://github.com/facebook/docusaurus/blob/main/LICENSE).
- Bad, because Docusaurus does not detect stale translations: ["we unfortunately don't have a good way to help you do so"](https://docusaurus.io/docs/i18n/git). The parity check is this project's own code to own and test. It covers Markdown and MDX pages; the Italian text inside interactive flow files is checked for presence only, not for staleness.
- Bad, because the text of the site frame is outside that check. Docusaurus has JSON translation files for it, which `docusaurus write-translations` writes (["Write the JSON translation files that you will have to translate"](https://docusaurus.io/docs/cli)); this repository has none under `website/i18n/it/`, the parity check does not read JSON files, and in the local build of 2026-11-14 the navigation label "Guidelines" is in English on the Italian pages (recorded in the chapter's Verification status).
- Bad, because a page with no Italian file is still built under `/it/` with its English text: in the local build of 2026-11-14 this was so for this record and for the chapter, before either had an Italian file (recorded in the chapter's Verification status). `task i18n:check` is the check that reports a missing Italian file.
- Bad, because `task i18n:check` fails for as long as this record has no Italian translation; on 2026-11-14 it reported this record and the chapter as missing. The decider accepted this for the pilot.
- Bad, because pages that embed components are MDX, where ["anything that looks like HTML is actually JSX"](https://docusaurus.io/docs/markdown-features/react), a format the Docusaurus documentation calls ["quite strict"](https://docusaurus.io/docs/markdown-features/react). Two research lanes conclude, in their analysis of trade-offs, that pages with interactive components are not portable to Hugo with Docsy, MkDocs or Antora without rewriting; no research finding names a tool that reads them as they are. The comparison does not score that analysis, because it is not a finding.
- Bad, because the link check is partial: broken anchors only warn by default ([docusaurus.config.js](https://docusaurus.io/docs/api/docusaurus-config)) and this repository does not change that setting. The Docusaurus configuration page does not say whether external URLs are checked; the only statement found is a [maintainer comment from 2020](https://github.com/facebook/docusaurus/issues/3303) saying they are not, and a third-party pull request claims the opposite (not verified). The chapter documents these gaps; fixes are a separate follow-up.
- Bad, because the checks run only on a workstation today: the repository has no pipeline configuration. The decider decided this for now; enforcement on the forge is wired in the delivery phase.
- Bad, because on GitHub, branch protection [does not apply to repository administrators by default](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches). No decision covers this; it is accepted by accepting this record.
- Bad, because the research did not cover whether a pull-request review can be made required on GitHub. No decision covers this; it is accepted by accepting this record.
- Bad, because of who can read the site on GitHub Pages. According to [GitHub's page on privately published sites](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/about-privately-published-github-pages-sites), a privately published site can be read only by people with read access to the repository; otherwise the site is public on the Internet. With Enterprise Managed Users a site can only be private and is accessible only to enterprise members; whether a member without read access to the repository can open it is not documented. Without Enterprise Managed Users, stakeholders who have no role on the repository can therefore read the site only if it is public. Whether those readers consume a paid licence is not documented on the Pages pages read; on GitHub Enterprise Cloud, organisation members and outside collaborators on private or internal repositories [consume a licence](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/github-license-users). This limitation is not accepted by this record: it is an open point for the hosting chapter, which decides between private and public publication.
- Bad, because, as published on GitHub Pages, the site is served by GitHub's service, so the comparison scores it, by definition and not from a researched fact, as not on the organisation's own infrastructure and not readable without Internet access. The [build output is static files](https://docusaurus.io/docs/deployment) that another host could serve; the hosting chapter weighs that.
- Bad, because leaving GitHub Enterprise Cloud has a cost for a private site: private publishing exists only with Enterprise Cloud, and after an organisation leaves it, its existing private sites stay private, cannot be made public, and no new private site can be created ([GitHub's page on privately published sites](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/about-privately-published-github-pages-sites)). No decision covers this; it is accepted by accepting this record.
- Bad, because GitHub's [feature overview for GitHub Enterprise Cloud with data residency](https://docs.github.com/en/enterprise-cloud@latest/admin/data-residency/feature-overview-for-github-enterprise-cloud-with-data-residency) does not mention GitHub Pages, neither as available nor as unavailable, so whether the decided host can be used there is not established. No decision covers this; it is accepted by accepting this record.
- Bad, because the GitHub Pages pages read describe no preview deployment per pull request, and no official announcement of one was found: as documented, a reviewer sees the rendered change before it is merged only by building the branch locally. Third-party actions for previews are known only from secondary sources. No decision covers this; it is accepted by accepting this record.
- Bad, because GitHub Pages has [published limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): a site no larger than 1 GB, a soft bandwidth limit of 100 GB per month, and deployments that time out after 10 minutes. Whether they matter for this site is an open point for the hosting chapter.
- Bad, because the site is not yet configured for GitHub Pages: `website/docusaurus.config.ts` sets a placeholder `url` and does not set `trailingSlash`, which the [Docusaurus deployment guide](https://docusaurus.io/docs/deployment) recommends setting explicitly on GitHub Pages. This is delivery-phase work.
- Bad, because a migration is ahead: Docusaurus says 3.10 ["will be the last release in the v3.x line, and it helps you prepare for Docusaurus v4"](https://docusaurus.io/blog); the research gives no date for v4 and does not say how long 3.10 receives fixes. The documented minimum, Node.js 20, is [end of life](https://nodejs.org/en/about/previous-releases), and `website/package.json` still admits Node 20.
- Bad, because installing dependencies without Internet access needs a pre-filled package store: with `--offline`, [pnpm uses only packages already in the store](https://pnpm.io/cli/install). Whether the build then runs without Internet access, and whether the built site makes requests to the Internet when read, are not established.
- Bad, because contributing through git and pull requests is available, but the research names no other contribution route with a review step (Docusaurus names translation workflows through SaaS software, with no review step described, and an editor of its own has no finding), and Docusaurus lists its git translation workflow as ["Hard for non-developers"](https://docusaurus.io/docs/i18n/git).
- Bad, because diagram labels stay in English in both languages: one exported SVG serves both locales, and Google notes that text inside figures ["increases localization costs if figures are localized"](https://developers.google.com/style/images) and "hurts accessibility and searchability"; the second cost applies to these diagrams as they are.
- Bad, because one chapter serves three audiences. Google advises keeping documents for customers apart from documents for providers ["As much as possible"](https://abseil.io/resources/swe-book/html/ch10.html); one research lane, in its own analysis, calls one source for three audiences consistent with that guidance but stricter. The approach relies on every chapter having the same fixed sections, and no evidence shows that they are enough.
- Bad, because the site has no search until the later work on search is done.

### Confirmation

Each of these tasks is expected to pass before a change is published. Today they run on a workstation and nothing on the forge enforces them; enforcement is wired in the delivery phase.

- `task content:lint`: every chapter and decision record has its frontmatter and required sections.
- `task i18n:check`: no Italian page is missing, orphaned or stale against its English source.
- `task diagrams:check`: every draw.io source has a current SVG export and every SVG has a source.
- `task flows:check`: every interactive flow file is well formed and has English and Italian text.
- `task site:build`: both locales build, with `onBrokenLinks` and `markdown.hooks.onBrokenMarkdownLinks` set to `throw` in `website/docusaurus.config.ts`.

`task verify` runs them together with `doctor`, `test:tools` and `agentic:lint`, and `Taskfile.yml` describes it as stopping at the first failure. On 2026-11-14 `task i18n:check` failed because this record and the chapter had no Italian translation yet, so `task verify` could not pass until the translations existed; once they existed, `task verify` was run on the same day and exited 0 (recorded in the chapter's Verification status). Running the same tasks as required checks on GitHub is wired in the delivery phase.

## Pros and Cons of the Options

### Docusaurus in git, English canonical, Italian translated and checked by a parity gate, published on GitHub Pages

The comparison scores the tool published on GitHub Pages; the parity gate is this repository's own code and is not scored.

- Good, because two languages from one tree, React components in pages, Mermaid and a build that fails on broken internal links are documented features (see Consequences).
- Good, because the site, the step-through component and the check tasks already exist in this repository, and the site builds in both locales.
- Bad, because the tool does not detect stale translations, broken anchors only warn by default, and external-link checking is not documented.
- Bad, because two research lanes conclude that MDX pages with components would need rewriting to move to another tool (their analysis, not a finding), 3.10 is the last release of the 3.x line, readers of a private GitHub Pages site need read access to the repository, and, as published on GitHub Pages, the site is not on the organisation's own infrastructure (by definition).
- Open: required pull-request reviews on GitHub, SVG images (no research finding), editing of its own for people who do not use git, the lifecycle of GitHub Enterprise Cloud and GitHub Pages, whether another tool can read its MDX pages as they are, building without Internet access.

### Hugo with the Docsy theme in git

- Good, because each language has its own content root and the [language menu](https://www.docsy.dev/docs/language/) goes to the translated version of the current page or to that language's home page; Hugo links translations [by path, content directory or a shared key](https://gohugo.io/content-management/multilingual/).
- Good, because Docsy renders [Mermaid from a code block](https://www.docsy.dev/docs/content/diagrams-and-formulae/) and can add an edit button to SVG images that embed their draw.io source (an editing aid, not a renderer of draw.io files), and links written with `ref` or `relref` fail the build by default ([configuration](https://gohugo.io/configuration/all/)).
- Good, because Hugo is [Apache-2.0](https://gohugo.io/about/license/) with releases dated July to October (the research fetcher inferred the year 2026) on its [releases page](https://github.com/gohugoio/hugo/releases), and Docsy is an Apache-2.0 [Linux Foundation project](https://github.com/google/docsy).
- Bad, because Hugo's [embedded link render hook](https://gohugo.io/render-hooks/links/) does not report a destination it cannot resolve; whether a broken plain Markdown link can fail a Hugo build is not established.
- Open: a separate address per language (the language pages do not state it), embedding a React component in a Markdown page (the [`js.Build`](https://gohugo.io/functions/js/build/) page bundles React code but does not document embedding it in a page), SVG images in pages, detection of stale translations, an editor of its own for people who do not use git, Docsy's maintenance (no dated Docsy release in the research), the lifecycle of GitHub Enterprise Cloud and GitHub Pages, building without Internet access.

### Antora in git

- Good, because content versions come from git branches or tags, with the version name taken from the `version` key ([versioning methods](https://docs.antora.org/antora/latest/content-source-versioning-methods/)), and Antora 3 is listed as active, with its end of life still to be set, on its [release schedule](https://docs.antora.org/antora/latest/project/release-schedule/), which also says dates are estimates and that a line is typically supported for one year after general availability.
- Good, because an unresolved cross reference is [logged as an error](https://docs.antora.org/antora/latest/playbook/runtime-log-format/) and a [failure level](https://docs.antora.org/antora/latest/playbook/runtime-log-failure-level/) makes the build exit non-zero for messages at or above it (default `fatal`).
- Bad, because AsciiDoc is its content language and the [documentation](https://docs.antora.org/antora/latest/) does not list Markdown as an input; whether it cannot process Markdown at all is not established.
- Bad, because the documented route to Mermaid is the [asciidoctor-kroki extension](https://docs.asciidoctor.org/kroki-extension/latest/) with a Kroki server, and that extension's JavaScript versions 1.0 and later are reported as not yet compatible with Antora.
- Open: localization (no official Antora page found; Fedora reported [building a separate site per language](https://communityblog.fedoraproject.org/fedora-docs-translations-fad-report/), a secondary source), interactive components, SVG images, an editor of its own for people who do not use git, the lifecycle of GitHub Enterprise Cloud and GitHub Pages, building without Internet access.

### Material for MkDocs in git

- Good, because link problems become errors with [`mkdocs build --strict`](https://www.mkdocs.org/user-guide/configuration/) (anchor checks default to `info`), Mermaid is [supported natively](https://squidfunk.github.io/mkdocs-material/reference/diagrams/), and an [offline plugin](https://squidfunk.github.io/mkdocs-material/plugins/offline/) makes a built site work from the file system; that concerns a copy read from the file system, not the site served by GitHub Pages.
- Bad, because it ["only supports setting a canonical language for the entire project"](https://squidfunk.github.io/mkdocs-material/setup/changing-the-language/): a second language is a second project.
- Bad, because it is [in maintenance mode](https://squidfunk.github.io/mkdocs-material/blog/2025/11/05/zensical/): feature development has ended and critical fixes run through May 5, 2027. The same post calls MkDocs itself unmaintained since August 2024, and also ties the May 2027 date to the end of "upstream maintenance" without saying what upstream means. Its successor Zensical can build supported Material projects from the same `mkdocs.yml`.
- Open: interactive components, SVG images, detection of stale translations, an editor of its own for people who do not use git, the lifecycle of GitHub Enterprise Cloud and GitHub Pages, building without Internet access.

### Markdown rendered by GitHub (GitHub Enterprise Cloud)

- Good, because it is plain Markdown that GitHub renders, [Mermaid included](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams), with nothing to build or host, and GitLab also renders [Markdown documents and Mermaid](https://docs.gitlab.com/user/markdown/).
- Bad, because readers of a private or internal repository need a role on it, and on GitHub Enterprise Cloud organisation members and outside collaborators on private or internal repositories [consume a licence](https://docs.github.com/en/enterprise-cloud@latest/billing/reference/github-license-users); a public repository is open to everyone.
- Bad, because the rendered view is GitHub's service, so the comparison scores it, by definition and not from a researched fact, as not on the organisation's own infrastructure and not readable without Internet access; every clone of the repository still holds the Markdown files.
- Open: link checking by GitHub itself, interactive components, SVG images, two languages and any language routing, the lifecycle of GitHub Enterprise Cloud.

### Azure DevOps Services wiki published as code

- Good, because the content is Markdown in a git repository and review comes from branch policies on the published branch ([publish a repo as a wiki](https://learn.microsoft.com/azure/devops/project/wiki/publish-repo-to-wiki?view=azure-devops)), including a [minimum number of reviewers and required build validation](https://learn.microsoft.com/azure/devops/repos/git/branch-policies-overview?view=azure-devops).
- Bad, because nothing runs between merge and publication (["No other workflows are involved"](https://learn.microsoft.com/azure/devops/project/wiki/publish-repo-to-wiki?view=azure-devops)), and link checking runs only when a page is moved in the wiki interface ([add and edit wiki pages](https://learn.microsoft.com/azure/devops/project/wiki/add-edit-wiki?view=azure-devops)).
- Bad, because ["Markdown in Azure DevOps doesn't support JavaScript or iframes"](https://learn.microsoft.com/azure/devops/project/wiki/markdown-guidance?view=azure-devops); Mermaid support is limited, `flowchart` syntax among the unsupported, and SVG is not among the listed attachment image formats.
- Bad, because in private projects free Stakeholder users [cannot read published code wikis](https://learn.microsoft.com/azure/devops/project/wiki/manage-readme-wiki-permissions?view=azure-devops), and public projects are [being retired](https://learn.microsoft.com/azure/devops/organizations/projects/public-projects-retirement?view=azure-devops), with anonymous access disabled in 2027.
- Open: detection of stale translations, any multi-language feature, inline SVG images.

### Confluence Cloud (Premium plan)

Examined and not totalled: no research finding sets a level for this option on two languages, automated checks, or components and diagrams.

- Good, because pages are edited in the browser, [page history](https://support.atlassian.com/confluence-cloud/docs/use-confluence-for-technical-documentation/) shows each version with its author, and [approvals](https://support.atlassian.com/confluence-cloud/docs/request-and-manage-approvals-in-confluence/) exist on the Premium and Enterprise plans; a space admin can require approval before new pages go live (edits of existing pages are not addressed).
- Bad, because its [export formats](https://support.atlassian.com/confluence-cloud/docs/export-content-to-word-pdf-html-and-xml/) are Word, PDF, CSV, HTML and XML; Markdown is not mentioned.
- Good, because on the Premium plan readers can have anonymous access limited by an IP allowlist, with no licence, and guests can stay non-billable, according to Atlassian's [knowledge-base article on unlicensed readers](https://confluence.atlassian.com/spaces/CONFKB/pages/1381400731/Methods+to+allow+unlicensed+users+to+read+Confluence+Cloud+content); Atlassian flags that article as requiring fixes, the research advises re-checking it, and a third-party claim that anonymous access ends after December 1, 2026 is unconfirmed.
- Bad, because it is Atlassian's service, so the comparison scores it, by definition and not from a researched fact, as not on the organisation's own infrastructure and not readable without Internet access.
- Open: translated content (two research files disagree on whether Atlassian's article on translating page content covers Cloud, and a Cloud request for [page versions per language](https://jira.atlassian.com/browse/CONFCLOUD-64788) is unresolved), whether Cloud attributes several editors inside one version, automated checks, diagrams, interactive components.

### SharePoint Online (pages and document libraries)

- Good, because [content approval](https://learn.microsoft.com/sharepoint/dev/business-apps/power-automate/guidance/require-doc-approval), a library setting, hides a document until it is approved, a [page approval flow](https://learn.microsoft.com/power-automate/customize-sharepoint-page-approvals) sends every added or modified page for approval (not available in government cloud environments; its licence was not looked up), and [version history](https://learn.microsoft.com/sharepoint/version-overview) shows who changed a file.
- Good, because communication sites have [multilingual pages](https://support.microsoft.com/office/create-multilingual-communication-sites-pages-and-news-2bb7d610-5453-41c6-a0e8-6f40b3ed750c) whose translators are emailed when the default page changes, Microsoft Entra B2B guests [need no licence for most collaboration](https://learn.microsoft.com/microsoft-365/enterprise/external-guest-access) and see only what is shared with them, and Microsoft Purview offers a [disposition review](https://learn.microsoft.com/purview/disposition) at the end of a retention period (its licence was not looked up).
- Bad, because each translation page is updated by hand, and, as Microsoft's service, the comparison scores it, by definition and not from a researched fact, as not on the organisation's own infrastructure and not readable without Internet access.
- Open: a separate address per language, automated checks on links or structure, interactive components, diagrams, the licence internal readers need, the licence for page approval flows, the licence for Purview disposition review, and how content leaves the platform.

### SharePoint Server Subscription Edition

Examined and not totalled: no research finding sets a level for this edition on two languages, automated checks, or components and diagrams.

- Good, because document libraries offer versions, check-in comments and a [content approval step](https://learn.microsoft.com/sharepoint/governance/versioning-content-approval-and-check-out-planning), and Subscription Edition has [no planned end of support](https://learn.microsoft.com/lifecycle/additional-support-server-modern-lifecycle-policy), with an earliest possible date of December 31, 2035.
- Open: multilingual sites ([variations](https://learn.microsoft.com/sharepoint/sites/plan-for-multilingual-sites) are documented for SharePoint Server without naming an edition), automated checks, interactive components, diagrams, reader licensing, export, reading without Internet access.

## More Information

- Chapter this record supports: [Documentation as code](../00-foundations/docs-as-code.mdx).
- Related records: none yet. A later hosting chapter, with its own decision record, covers reader access, limits and alternatives for the published site.
- Considered and not scored: Confluence Data Center (new customers, organisations that never held paid Data Center seats, [cannot buy it since March 30, 2026](https://www.atlassian.com/licensing/data-center-end-of-life), existing customers can buy until March 30, 2028, and it becomes read-only on March 28, 2029; whether this organisation ever held such seats is not established); the Azure DevOps provisioned wiki, the GitLab wiki and the GitHub wiki (the research covers who can read and edit them and which markup they accept, nothing on two languages or automated checks); plain Markdown in a self-managed forge such as GitLab or Forgejo (the same shape as Markdown rendered by GitHub, which is scored once, on the decided forge; what a self-managed forge changes is in the revisit conditions below); plain Markdown built by GitHub Pages with Jekyll (GitHub's documentation gives [Jekyll 3.10.0](https://pages.github.com/versions/) and a fixed list of plugins, and does not mention several languages, link checking during the build or JavaScript components; Jekyll's own documentation was not researched); Azure DevOps Server (no research on publishing code wikis there); Zensical (language and versioning support not established); docfx (one secondary source); Wiki.js (no readable source).

Revisit this decision when one of these holds:

- Most authors do not use git and will not open pull requests: keep the site and add a self-hosted translation tool such as [Weblate](https://docs.weblate.org/en/latest/formats.html), whose support for MDX is not in the research, or, if review of each change in git is not required, move to a platform edited in the browser, where this repository's file-based checks would not apply.
- More than two languages, or external translators, are needed: move translation from hash stamps to a translation management tool. No research finding sets that threshold; it is the author's judgment and not verified.
- The content is one language and a few pages for engineers who all have repository access, with no interactive components: Markdown rendered by GitHub is enough.
- The forge is self-managed, or the guidelines must be served from the organisation's own infrastructure (this reverses the decision on the forge, on the host, or on both): keep Docusaurus, whose output is static files that another host can serve, and score review, checks that stop a merge, reach, continuity and own infrastructure again for that forge and host. On a self-managed GitLab, approvals that block a merge need the [Premium or Ultimate tier](https://docs.gitlab.com/user/project/merge_requests/approvals/), "Pipelines must succeed" is a [project setting](https://docs.gitlab.com/user/project/merge_requests/auto_merge/) in every tier, [GitLab Pages](https://docs.gitlab.com/user/project/pages/) is in the Free tier, and its [access control](https://docs.gitlab.com/user/project/pages/pages_access_control/) offers "Only Project Members" or "Everyone" in every tier. On Forgejo, branch protection can require [a number of approvals](https://forgejo.org/docs/latest/user/protection/); required status checks are not mentioned in Forgejo's own documentation.
- The organisation leaves GitHub Enterprise Cloud, or moves to GitHub Enterprise Cloud with data residency: private publishing on GitHub Pages depends on Enterprise Cloud, and Pages is not mentioned in the feature list for data residency; decide the host again.
- Documentation is assembled from many repositories and several product versions must be published side by side, in one language: Antora.
- A published version selector becomes a requirement (this reverses the decision on versioning): enable Docusaurus docs versioning, keep fewer than 10 versions, and budget a translated copy per version, whose folder layout is not verified.
- The organisation moves its documentation to Azure DevOps (this reverses the decision on the forge), every reader has Basic access, and neither interactive components nor SVG images are needed: the Azure DevOps code wiki in a private project, with branch policies as the only gate.
- Docusaurus version 4 breaks the site's components or the project stops releasing: re-examine the alternatives above, starting from the open points listed for each.
- An existing Material for MkDocs estate: plan its move to Zensical before May 5, 2027; Zensical's language and versioning support is not verified.
- Stakeholders must read without a role on the repository and the site may not be public: GitHub's documentation describes no way to do this on GitHub Pages (with Enterprise Managed Users, whether an enterprise member without read access to the repository can open a site is not documented), so it is a hosting question for the hosting chapter.
- The hosting chapter chooses a host other than GitHub Pages: re-score reach, continuity and own infrastructure for the generators on that host.
- Research closes open points of Docusaurus or of an alternative: re-score; the comparison may then separate them.

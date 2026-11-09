# Primary sources reviewed with Exa
Retrieved 9 November 2026. Exa was used for discovery and page retrieval, with technical recommendations grounded in primary sources. Paraphrases are used rather than long quotations. These are acceptance references, not certifications of this app.

| Source | URL | Use in this kit |
|---|---|---|
| W3C WCAG 2.2 quick reference | https://www.w3.org/WAI/WCAG22/quickref/ | Applicable AA criteria inventory |
| W3C target size minimum | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | 24 CSS px AA requirement and exceptions; distinguish 44px product target |
| W3C financial error prevention | https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html | Review/correct/reverse important submissions; avoid needless confirmation on every save |
| W3C labels/instructions | https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html | Clear labels/instructions, with separate semantic association requirements |
| W3C ARIA modal pattern | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Inert background, focus containment, initial and restored focus |
| GOV.UK structuring forms | https://www.gov.uk/service-manual/design/form-structure | Question protocol and merging pages for frequent internal work |
| ATO setting up invoices | https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/record-keeping-for-business/setting-up-and-managing-records/setting-up-your-business-invoices | Invoice vs tax-invoice labeling based on GST registration |
| ATO tax invoices | https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices | Field requirements for taxable sales; buyer identity or ABN for $1,000+ tax invoices; rounding guidance |
| OWASP ASVS | https://owasp.org/www-project-application-security-verification-standard/ | Security verification framework; select and record concrete requirements during implementation |
| Supabase RLS | https://supabase.com/docs/guides/database/postgres/row-level-security | Database permissions and allow/deny tests |
| Supabase changelog | https://supabase.com/changelog.md | Check relevant version changes before work; repo uses CLI v2, do not copy CLI v3 assumptions |
| web.dev Web Vitals | https://web.dev/articles/vitals | Field p75 loading, interaction and stability targets |
| Node releases | https://nodejs.org/en/about/previous-releases | Supported LTS runtime choice; CI Node 20 is EOL |
| OpenAI cloud environments | https://learn.chatgpt.com/docs/environments/cloud-environments | Current setup/publication/start flow and network/variable configuration |
| OpenAI AGENTS.md guidance | https://learn.chatgpt.com/docs/agent-configuration/agents-md | Repo-root and nested instruction loading |
| OpenAI ChatGPT Projects | https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt | Instructions, files and ongoing planning context |

The reviewed repo and pinned source links in REVIEW.md are the evidence for app behavior. Standards links justify proposed acceptance checks; they do not prove a particular failure occurred in a rendered app. Prefer current primary documentation if these URLs or product interfaces change.

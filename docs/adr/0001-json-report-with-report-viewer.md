# JSON Report read through a Report Viewer, not a PDF

Students turn in a `.json` Report rather than the print-to-PDF page the old apps produced. Instructors need machine-readable Reports so the Report Viewer can score a whole Brightspace bulk-download, flag duplicate Runs (shared Run ID, identical Attempt history, a sealed name that doesn't match the uploader, a failed checksum) and export grades. Students read or print their own Report by opening it in the same Report Viewer page.

## Considered Options

- **PDF (the old approach)**: easy to read and previews inline in Brightspace, but it can't be graded in bulk or checked for duplicates.
- **A self-contained HTML Report with the JSON embedded in it**: one file that students can double-click and the viewer can parse. It was rejected in favour of keeping the turned-in artifact pure data.
- **JSON plus a separate PDF copy**: rejected because students would upload the wrong file.

## Consequences

Brightspace won't preview the Reports inline, so every Report is read through the Report Viewer. The checksum and Run fingerprint only deter cheating: the answer keys and the hashing run client-side on a public GitHub Pages site.

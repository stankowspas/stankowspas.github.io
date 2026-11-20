# Devanagari Cryptor 4.3.9 — draft independent archive mode

This is an additive development build based on **app-4.3.8.html**. The three existing modes and their encoding/encryption/file formats are left intact. This is **not** yet a production release.

## Start

Keep these files together in the same folder:

- app-4.3.9.html
- archive-mode.js
- archive-vendor/libarchive.js
- archive-vendor/worker-bundle.js
- archive-vendor/libarchive.wasm
- archive-vendor/LICENSE

Open **app-4.3.9.html** over HTTPS (e.g. GitHub Pages after merging) or a local HTTP server. A direct file:// URL may block module workers and WebAssembly.

For a local preview with Python, run `python -m http.server 8000` from the directory holding the files and then open `http://localhost:8000/app-4.3.9.html`.

No file content is uploaded to a server. All archive processing is performed locally in the browser using a locally supplied libarchive.js WebAssembly worker.

## Features

- Fourth "Archiver" mode with independent UI and inherited color themes: Dark Sanskrit, Classic Sanskrit, Blue, Graphite.
- 12 languages supported for archive UI, matching the current app.
- Select many files and/or a folder, preserving relative file paths.
- Create: ZIP, 7z, TAR, TAR.GZ, TAR.BZ2, TAR.XZ (subject to compiled engine capabilities).
- Open: ZIP, 7z, RAR v4/v5, TAR, GZIP, BZIP2 and XZ and other libarchive-compatible archives; actual support may vary with archive features.
- View regular file entries, select files, extract directly to a chosen local folder where the File System Access API is supported, or download one file / a ZIP of many extracted files.
- Show uncompressed and archive size and achieved space reduction. Compression can also enlarge already-compressed inputs.
- Optional password on extraction is passed to the library. Not all encrypted archive variants are supported. The mode **does not create encrypted archives**.

## Safety and limits

This is a prototype with no executed browser end-to-end test at the time of creation.

- Up to 2,000 input files, max 150 MiB total input for creation.
- Up to 250 MiB input archive for opening.
- Up to 300 MiB declared uncompressed content for preview and extraction, and checks against reported per-file sizes.
- Rejects absolute paths and parent-directory path traversal, duplicate extracted entries, and entries with invalid sizes.
- Skips archive entry types other than regular files; does not extract symbolic links.
- Filenames are sanitized on extraction.
- Keep originals until independently confirmed recovery. For encrypted .bgdev archives, the independent file-protection mode retains responsibility for encryption/decryption.
- Browser RAM usage can exceed file size because libarchive-WASM processes data in memory.
- Password-protected 7z/RAR archives may not decrypt in this browser build; encrypted ZIP support varies with method.

## Verification suggested before a production merge

1. Create ZIP/TAR/7z from multiple files and folders; open with independently installed desktop archive tools.
2. Open real RAR4, RAR5, ZIP, 7z, TAR.GZ, TAR.BZ2, TAR.XZ and a password-protected ZIP archive.
3. Compare SHA-256 of each extracted file with the source.
4. Test UTF-8 filenames, empty files, nested directories, malicious "../" and absolute entry names, large input, different browser/device combinations.
5. Verify legacy three modes on the same test vectors from release 4.3.8.
6. Test all four themes and 12 interface languages.

## Licenses and provenance

Base application: MIT, © 2026 Spas Stankov (original license preserved verbatim).
Archive engine: libarchive.js 2.0.2 (MIT); source https://github.com/nika-begiashvili/libarchivejs.
libarchive underneath carries BSD-style licensing; worker bundle contains third-party code including Apache-2.0 license notices.
Retain library LICENSE, and review vendored dependencies' notices before distributing a final commercial release.

# Web Office

Developed by **Spas Stankov**.

Web Office is a standalone browser application for reversible Unicode-to-Devanagari text encoding and password-protected text and file encryption.

**Live application:** https://stankowspas.github.io/projects/devanagari-cryptor/

## Features

- Classic mode: reversible Unicode text encoding into Devanagari (no password).
- Secure mode: password-protected text using AES-256-GCM.
- File protection: encrypt and recover original file bytes and filename using a password.
- Twelve interface languages; English by default.
- Four visual themes.
- Runs entirely in the browser. The standalone HTML also supports offline use.

## Usage

Open the live application or save `app-4.4.0.html` and open it locally in a compatible browser. Use a strong, memorable password for protected text and files. **There is no password recovery.**

Encrypted data is processed locally in the browser; this application does not require a server to upload your files. Do not rely on it as the sole copy of important data. Verify recovered files before deleting originals.

## Compatibility and limitations

- Secure operations require browser Web Crypto support in a secure context.
- Unicode output can be substantially larger than the original binary data.
- Text-mode DOCX import extracts text, not complete Word formatting. Use file protection to preserve document bytes.
- The application has undergone automated tests but has **not received an independent security audit**.

## License

MIT License — Copyright (c) 2026 Spas Stankov. See [LICENSE](LICENSE).

[Developer website](https://stankowspas.github.io/en/)

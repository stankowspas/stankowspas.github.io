# Third-party components — DWG Quantity Inspector V2

The application interface and browser-side integration are developed by Spas Stankov.

This deployment loads externally hosted JavaScript and WebAssembly through jsDelivr:

- **@mlightcad/libredwg-web 0.7.17**, GNU GPL-3.0. Exact package: https://www.npmjs.com/package/@mlightcad/libredwg-web/v/0.7.17 . Source repository: https://github.com/mlightcad/libredwg-web . Upstream LibreDWG: https://www.gnu.org/software/libredwg/
- **ExcelJS 4.4.0**, MIT license. Source repository: https://github.com/exceljs/exceljs . Exact package: https://www.npmjs.com/package/exceljs/v/4.4.0

The application HTML and JavaScript integration files are publicly accessible in this repository. Third-party software is loaded from the exact package versions indicated above; its corresponding source code, license and notices can be obtained from those upstream projects and package distributions. The GPL-3.0 license remains applicable to the GPL-covered components and any work derived from them, where applicable. These terms do not curtail GPL-granted rights.

The browser requests scripts and WebAssembly from jsDelivr; this reveals technical network information, such as the client's IP address, to the CDN provider. Selected DWG drawing data is processed locally in the browser by the application; it is not uploaded to a DWG conversion API.

Only deployment files are published. No private/test user DWG drawings or project records are included.
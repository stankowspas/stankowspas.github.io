/* Devanagari Cryptor 4.3.9 — independent archive mode.
 * Uses vendored libarchive.js 2.0.2 and its local worker/WASM files.
 * Existing encoding, encryption and .bgdev protocols are not modified.
 */
(function () {
"use strict";
const $ = id => document.getElementById(id);
const data = {
 bg:["Архиватор","Самостоятелно архивиране и разархивиране без качване в интернет.","Създаване на архив","Файлове","Избери файлове","Избери папка","Формат","Създай архив","Отваряне на архив","Избери архив","Парола за архива (ако е необходима)","Преглед","Извлечи избраните","Извлечи в папка","Избери всички","Съдържание на архива","Не са избрани файлове.","Няма избран архив.","Архивът е създаден.","Файловете са възстановени.","Обработване…","Размер на входа","Размер на архива","Спестено място","Файловете не се изпращат към сървър. ZIP, 7z, TAR и компресиран TAR могат да се създават; ZIP, 7z, RAR, TAR, GZ, BZ2 и XZ могат да се отварят според възможностите на двигателя.","За извличане на много файлове се запазва структурата на папките. Ако директното записване в папка не се поддържа, файловете се изтеглят като ZIP.","Архивирането само по себе си не шифрова данните."],
 en:["Archiver","Independent offline archive creation and extraction; no file uploads.","Create archive","Files","Choose files","Choose folder","Format","Create archive","Open archive","Choose archive","Archive password (if required)","Preview","Extract selected","Extract into folder","Select all","Archive contents","No files selected.","No archive selected.","Archive created.","Files restored.","Processing…","Input size","Archive size","Space saved","Files stay on your device. ZIP, 7z, TAR and compressed TAR can be created; ZIP, 7z, RAR, TAR, GZ, BZ2 and XZ can be opened as supported by the engine.","For multiple extracted files, folder paths are preserved. If direct folder saving is unavailable, files are downloaded in a ZIP.","Compression alone does not encrypt files."],
 hi:["संग्रहकर्ता","फ़ाइलें अपलोड किए बिना ऑफ़लाइन संग्रह बनाएँ और खोलें।","संग्रह बनाएँ","फ़ाइलें","फ़ाइलें चुनें","फ़ोल्डर चुनें","प्रारूप","संग्रह बनाएँ","संग्रह खोलें","संग्रह चुनें","पासवर्ड (यदि आवश्यक हो)","पूर्वावलोकन","चयनित निकालें","फ़ोल्डर में निकालें","सभी चुनें","संग्रह सामग्री","फ़ाइलें नहीं चुनी गईं।","संग्रह नहीं चुना गया।","संग्रह बन गया।","फ़ाइलें बहाल हो गईं।","प्रसंस्करण…","मूल आकार","संग्रह आकार","बचत","फ़ाइलें आपके उपकरण पर रहती हैं। ZIP, 7z, TAR और संपीड़ित TAR बनाए जा सकते हैं; ZIP, 7z, RAR, TAR, GZ, BZ2 और XZ खोलना इंजन पर निर्भर है।","कई फ़ाइलें निकालते समय फ़ोल्डर संरचना बनी रहती है।","संपीड़न से एन्क्रिप्शन नहीं होता।"],
 de:["Archivierung","Archive lokal erstellen und entpacken; kein Hochladen.","Archiv erstellen","Dateien","Dateien wählen","Ordner wählen","Format","Archiv erstellen","Archiv öffnen","Archiv wählen","Archivpasswort (falls nötig)","Vorschau","Auswahl entpacken","In Ordner entpacken","Alle auswählen","Archivinhalte","Keine Dateien gewählt.","Kein Archiv gewählt.","Archiv erstellt.","Dateien wiederhergestellt.","Verarbeitung…","Eingabegröße","Archivgröße","Platz gespart","Dateien bleiben lokal. ZIP, 7z, TAR und komprimierte TAR können erstellt werden; ZIP, 7z, RAR, TAR, GZ, BZ2 und XZ lassen sich je nach Engine öffnen.","Ordnerstruktur bleibt erhalten. Ohne Ordnerzugriff erfolgt ein ZIP-Download.","Kompression ist keine Verschlüsselung."],
 fr:["Archiveur","Créer et extraire des archives hors ligne, sans envoi de fichiers.","Créer une archive","Fichiers","Choisir des fichiers","Choisir un dossier","Format","Créer","Ouvrir une archive","Choisir une archive","Mot de passe (si nécessaire)","Aperçu","Extraire la sélection","Extraire dans un dossier","Tout sélectionner","Contenu","Aucun fichier sélectionné.","Aucune archive choisie.","Archive créée.","Fichiers restaurés.","Traitement…","Taille initiale","Taille d’archive","Économie","Les fichiers restent sur l’appareil. Création : ZIP, 7z, TAR et TAR compressé. Lecture : ZIP, 7z, RAR, TAR, GZ, BZ2, XZ selon le moteur.","La structure des dossiers est préservée; sinon téléchargement ZIP.","La compression n’est pas un chiffrement."],
 es:["Archivador","Crear y extraer archivos sin subirlos a Internet.","Crear archivo","Archivos","Elegir archivos","Elegir carpeta","Formato","Crear archivo","Abrir archivo","Elegir archivo","Contraseña (si es necesaria)","Vista previa","Extraer seleccionados","Extraer a carpeta","Seleccionar todos","Contenido","Sin archivos seleccionados.","Sin archivo seleccionado.","Archivo creado.","Archivos recuperados.","Procesando…","Tamaño original","Tamaño comprimido","Espacio ahorrado","Los archivos permanecen en el equipo. Crea ZIP, 7z, TAR y TAR comprimido; abre ZIP, 7z, RAR, TAR, GZ, BZ2 y XZ según el motor.","Se conservan las carpetas. Si no es posible elegir destino, se descarga un ZIP.","Comprimir no equivale a cifrar."],
 it:["Archiviatore","Creazione ed estrazione locale di archivi, senza upload.","Crea archivio","File","Scegli file","Scegli cartella","Formato","Crea archivio","Apri archivio","Scegli archivio","Password archivio (se serve)","Anteprima","Estrai selezionati","Estrai in cartella","Seleziona tutti","Contenuto archivio","Nessun file selezionato.","Nessun archivio selezionato.","Archivio creato.","File ripristinati.","Elaborazione…","Dimensione input","Dimensione archivio","Spazio risparmiato","I file restano sul dispositivo. Crea ZIP, 7z, TAR e TAR compressi; apre ZIP, 7z, RAR, TAR, GZ, BZ2, XZ secondo il motore.","Le cartelle vengono preservate; in alternativa scarica uno ZIP.","La compressione non cifra i dati."],
 pt:["Arquivador","Criar e extrair arquivos localmente, sem carregamentos.","Criar arquivo","Ficheiros","Escolher ficheiros","Escolher pasta","Formato","Criar arquivo","Abrir arquivo","Escolher arquivo","Palavra-passe (se necessário)","Pré-visualizar","Extrair selecionados","Extrair para pasta","Selecionar tudo","Conteúdo do arquivo","Sem ficheiros selecionados.","Sem arquivo selecionado.","Arquivo criado.","Ficheiros restaurados.","A processar…","Tamanho original","Tamanho comprimido","Espaço poupado","Os ficheiros ficam no dispositivo. Cria ZIP, 7z, TAR e TAR comprimido; abre ZIP, 7z, RAR, TAR, GZ, BZ2 e XZ conforme o motor.","Mantém a estrutura das pastas; se necessário descarrega ZIP.","Compressão não é encriptação."],
 pl:["Archiwizator","Twórz i rozpakowuj archiwa lokalnie, bez wysyłania plików.","Utwórz archiwum","Pliki","Wybierz pliki","Wybierz folder","Format","Utwórz archiwum","Otwórz archiwum","Wybierz archiwum","Hasło (jeśli wymagane)","Podgląd","Wypakuj wybrane","Wypakuj do folderu","Zaznacz wszystkie","Zawartość","Nie wybrano plików.","Nie wybrano archiwum.","Archiwum utworzone.","Pliki przywrócone.","Przetwarzanie…","Rozmiar wejścia","Rozmiar archiwum","Oszczędność","Pliki pozostają lokalnie. Tworzenie: ZIP, 7z, TAR i TAR skompresowany; odczyt: ZIP, 7z, RAR, TAR, GZ, BZ2, XZ zależnie od silnika.","Struktura katalogów jest zachowana; alternatywnie pobierz ZIP.","Kompresja nie szyfruje plików."],
 ro:["Arhivator","Creați și extrageți arhive local, fără încărcarea fișierelor.","Creează arhivă","Fișiere","Alege fișiere","Alege dosar","Format","Creează arhivă","Deschide arhivă","Alege arhivă","Parolă (dacă e necesară)","Previzualizează","Extrage selectate","Extrage în dosar","Selectează toate","Conținut","Niciun fișier selectat.","Nicio arhivă selectată.","Arhivă creată.","Fișiere restaurate.","Procesare…","Dimensiune inițială","Dimensiune arhivă","Spațiu economisit","Fișierele rămân pe dispozitiv. Creează ZIP, 7z, TAR și TAR comprimat; citește ZIP, 7z, RAR, TAR, GZ, BZ2 și XZ în funcție de motor.","Structura dosarelor se păstrează; alternativ descărcați ZIP.","Comprimarea nu criptează datele."],
 el:["Αρχειοθέτης","Δημιουργία και εξαγωγή αρχείων τοπικά, χωρίς μεταφόρτωση.","Δημιουργία αρχείου","Αρχεία","Επιλογή αρχείων","Επιλογή φακέλου","Μορφή","Δημιουργία","Άνοιγμα αρχείου","Επιλογή αρχείου","Κωδικός (αν απαιτείται)","Προεπισκόπηση","Εξαγωγή επιλεγμένων","Εξαγωγή σε φάκελο","Επιλογή όλων","Περιεχόμενα","Δεν επιλέχθηκαν αρχεία.","Δεν επιλέχθηκε αρχείο.","Το αρχείο δημιουργήθηκε.","Τα αρχεία αποκαταστάθηκαν.","Επεξεργασία…","Αρχικό μέγεθος","Μέγεθος αρχείου","Εξοικονόμηση","Τα αρχεία παραμένουν στη συσκευή. Δημιουργία ZIP, 7z, TAR και συμπιεσμένου TAR· ανάγνωση ZIP, 7z, RAR, TAR, GZ, BZ2, XZ εφόσον υποστηρίζονται.","Η δομή φακέλων διατηρείται· εναλλακτικά γίνεται λήψη ZIP.","Η συμπίεση δεν κρυπτογραφεί."],
 cs:["Archivátor","Vytvářejte a rozbalujte archivy lokálně bez odesílání souborů.","Vytvořit archiv","Soubory","Vybrat soubory","Vybrat složku","Formát","Vytvořit archiv","Otevřít archiv","Vybrat archiv","Heslo (pokud je potřeba)","Náhled","Rozbalit vybrané","Rozbalit do složky","Vybrat vše","Obsah archivu","Nejsou vybrány soubory.","Není vybrán archiv.","Archiv vytvořen.","Soubory obnoveny.","Zpracování…","Původní velikost","Velikost archivu","Úspora místa","Soubory zůstávají na zařízení. Vytvoření ZIP, 7z, TAR a komprimovaného TAR; čtení ZIP, 7z, RAR, TAR, GZ, BZ2 a XZ dle možností enginu.","Struktura složek zůstane zachována; jinak stáhněte ZIP.","Komprese není šifrování."]
};
const labels={bg:"Име на архива",en:"Archive name",hi:"संग्रह का नाम",de:"Archivname",fr:"Nom de l’archive",es:"Nombre del archivo",it:"Nome archivio",pt:"Nome do arquivo",pl:"Nazwa archiwum",ro:"Numele arhivei",el:"Όνομα αρχείου",cs:"Název archivu"};
const keys=["tab","intro","createHeading","filesLabel","chooseFiles","chooseFolder","format","create","openHeading","chooseArchive","password","preview","extract","extractFolder","selectAll","contents","noFiles","noArchive","created","restored","processing","inputSize","archiveSize","saved","formatHelp","folderHelp","noEncrypt"];
const L = () => data[currentLanguage] || data.en;
function tr(k){if(k==="nameLabel")return labels[currentLanguage]||labels.en;const i=keys.indexOf(k);return i<0?k:L()[i];}
function translateArchive() {
 document.querySelectorAll("[data-archive-i18n]").forEach(e => { e.textContent=tr(e.dataset.archiveI18n); });
 $("arcTab").textContent=tr("tab");$("arcTab").title=tr("tab");
 if(typeof UI!=="undefined"&&UI[currentLanguage])UI[currentLanguage].archive=tr("tab");
 const fileLabel=document.querySelector('label[for="arcFiles"]');const folderLabel=document.querySelector('label[for="arcFolder"]');
 if(fileLabel)fileLabel.title=tr("chooseFiles");if(folderLabel)folderLabel.title=tr("chooseFolder");
}
function displayBytes(n){return (n>=1048576?(n/1048576).toLocaleString(currentLanguage,{maximumFractionDigits:2})+" MiB":(n/1024).toLocaleString(currentLanguage,{maximumFractionDigits:1})+" KiB");}
function message(str,error){const target=$("arcStatus");target.textContent=str;target.className="archive-status "+(error?"archive-error":"");}
function safeName(p){
 const s=String(p||"").replace(/\\/g,"/").replace(/[\u0000-\u001f\u007f]/g,"_");
 if(!s||s.length>1024||s[0]==="/" || /^(?:[a-z]:|\/\/)/iu.test(s))throw new Error("Unsafe absolute archive path");
 const parts=s.split("/").filter(Boolean);
 if(!parts.length||parts.some(x=>x==="."||x===".."||x.length>255))throw new Error("Unsafe archive path");
 return parts.join("/");
}
function simpleName(p){return safeName(p).split("/").pop();}
function outputName(f){return f.name.replace(/(\.tar\.(gz|bz2|xz)|\.(zip|rar|7z|tar|gz|bz2|xz))$/iu,"")||"extracted";}
let enginePromise=null, opened=null, displayed=[], isBusy=false;
async function engine(){
 if(!enginePromise){
  enginePromise=import("./archive-vendor/libarchive.js").then(mod=>{
   mod.Archive.init({workerUrl:new URL("./archive-vendor/worker-bundle.js",document.baseURI).href});
   return mod;
  }).catch(err=>{enginePromise=null;throw new Error("Local archive engine unavailable. Open through HTTPS or a local web server and keep the archive-vendor folder. "+String(err.message||err));});
 }
 return enginePromise;
}
function setBusy(v){
 isBusy=v;
 for(const id of ["arcCreate","arcPreview","arcExtract"])$(id).disabled=v;
}
async function paint(){await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
function prepareUpload(){
 const list=[...$("arcFiles").files,...$("arcFolder").files];
 const unique=new Map();
 list.forEach(f=>{
  const path=safeName(f.webkitRelativePath||f.name);
  if(unique.has(path))throw new Error("Duplicate archive path: "+path);
  unique.set(path,{file:f,pathname:path});
 });
 if(!list.length)throw new Error(tr("noFiles"));
 if(list.length>2000)throw new Error("Limit: 2000 files");
 const total=list.reduce((s,f)=>s+f.size,0);
 if(total>150*1048576)throw new Error("Limit: 150 MiB input (browser memory protection)");
 return {files:[...unique.values()],total};
}
function refreshInputCount(){
 let n=$("arcFiles").files.length+$("arcFolder").files.length;
 let total=[...$("arcFiles").files,...$("arcFolder").files].reduce((s,f)=>s+f.size,0);
 $("arcInputSummary").textContent=n?n+" "+tr("filesLabel")+" · "+displayBytes(total):tr("noFiles");
}
function formatArgs(id){
 const m={
  zip:{format:"ZIP",compression:"NONE",ext:".zip"},
  seven:{format:"SEVEN_ZIP",compression:"NONE",ext:".7z"},
  tar:{format:"USTAR",compression:"NONE",ext:".tar"},
  tgz:{format:"PAX",compression:"GZIP",ext:".tar.gz"},
  tbz:{format:"PAX",compression:"BZIP2",ext:".tar.bz2"},
  txz:{format:"PAX",compression:"XZ",ext:".tar.xz"}
 };
 return m[id];
}
async function writeArchive(files,format,outputName){
 const m=await engine(),d=formatArgs(format);
 if(!d)throw new Error("Invalid archive format");
 return await m.Archive.write({
   files,format:m.ArchiveFormat[d.format],compression:m.ArchiveCompression[d.compression],
   outputFileName:outputName+d.ext,passphrase:null
 });
}
function saveBlob(blob,name){
 // Reuse the unchanged application's existing Blob downloader.
 download(blob,name);
}
$("arcFiles").addEventListener("change",refreshInputCount);
$("arcFolder").addEventListener("change",refreshInputCount);
$("arcSource").addEventListener("change",async()=>{
 displayed=[];$("arcContent").replaceChildren();
 $("arcArchiveSummary").textContent=$("arcSource").files[0]?.name||tr("noArchive");
 if(opened){await opened.close().catch(()=>{});opened=null;}
});
$("arcSelectAll").addEventListener("change",e=>{
 document.querySelectorAll("#arcContent input[type=checkbox]").forEach(c=>c.checked=e.target.checked);
});
$("arcCreate").addEventListener("click",async()=>{
 if(isBusy)return;setBusy(true);
 try {
  const inData=prepareUpload(),format=$("arcFormat").value;
  message(tr("processing"));await paint();
  const name=($("arcName").value.trim()||"archive").replace(/[/\\\u0000-\u001f]/g,"_").slice(0,120);
  const o=await writeArchive(inData.files,format,name);
  if(!o||!o.size)throw new Error("Archive creation did not produce a file.");
  saveBlob(o,name+formatArgs(format).ext);
  const diff=100*(1-o.size/inData.total);
  message(tr("created")+"\n"+tr("inputSize")+": "+displayBytes(inData.total)+"\n"+tr("archiveSize")+": "+displayBytes(o.size)+"\n"+tr("saved")+": "+(inData.total ? diff.toFixed(1)+"%" : "—"));
 } catch(e){message(e.message||String(e),true);}
 finally{setBusy(false);}
});
function entryPath(x){
 const filename=x.file?.name||"";
 return safeName(String(x.path||"")+String(filename));
}
$("arcPreview").addEventListener("click",async()=>{
 if(isBusy)return;setBusy(true);
 try {
  const f=$("arcSource").files?.[0];if(!f)throw new Error(tr("noArchive"));
  if(f.size>250*1048576)throw new Error("Limit: 250 MiB archive input");
  message(tr("processing"));await paint();
  if(opened){await opened.close().catch(()=>{});opened=null;}
  const m=await engine();opened=await m.Archive.open(f);
  const pass=$("arcPassword").value;
  if(pass)await opened.usePassword(pass);
  const items=await opened.getFilesArray();
  if(items.length>2000)throw new Error("Limit: 2000 archive entries");
  let size=0, seen=new Set();
  displayed=[];
  for(const item of items){
   if(!item.file || !item.file.extract)continue;
   const path=entryPath(item);
   if(seen.has(path))throw new Error("Duplicate archive entry: "+path);
   seen.add(path);
   const n=Number(item.file.size);
   if(!Number.isSafeInteger(n)||n<0||n>250*1048576)throw new Error("Unsafe entry size: "+path);
   size+=n;
   if(size>300*1048576)throw new Error("Expanded contents exceed 300 MiB limit");
   displayed.push({path,file:item.file,size:n});
  }
  if(!displayed.length)throw new Error("Archive contains no supported regular files.");
  const area=$("arcContent");area.replaceChildren();
  displayed.forEach((item,index)=>{
   const lab=document.createElement("label");lab.className="archive-entry";
   const check=document.createElement("input");check.type="checkbox";check.checked=true;check.dataset.index=index;
   const span=document.createElement("span");span.textContent=item.path;
   const small=document.createElement("small");small.textContent=displayBytes(item.size);
   lab.append(check,span,small);area.append(lab);
  });
  $("arcSelectAll").checked=true;
  $("arcExtract").disabled=false;
  message(tr("contents")+": "+displayed.length+" · "+displayBytes(size));
 } catch(e) {
  if(opened){await opened.close().catch(()=>{});opened=null;}
  displayed=[];$("arcContent").replaceChildren();
  message(e.message||String(e),true);
 }finally{setBusy(false);}
});
async function saveToDirectory(files){
 const root=await window.showDirectoryPicker({mode:"readwrite"});
 for(const item of files){
  const parts=safeName(item.path).split("/");
  let dir=root;
  for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part,{create:true});
  const h=await dir.getFileHandle(parts[parts.length-1],{create:true});
  const writer=await h.createWritable();
  try{await writer.write(item.blob);await writer.close();}
  catch(e){await writer.abort().catch(()=>{});throw e;}
 }
}
$("arcExtract").addEventListener("click",async()=>{
 if(isBusy)return;setBusy(true);
 try{
  if(!opened||!displayed.length)throw new Error(tr("noArchive"));
  const boxes=[...document.querySelectorAll("#arcContent input[type=checkbox]:checked")];
  if(!boxes.length)throw new Error("Select at least one file.");
  message(tr("processing"));await paint();
  const selected=boxes.map(x=>displayed[Number(x.dataset.index)]);
  const files=[];let total=0;
  for(const item of selected){
   const blob=await item.file.extract();
   total+=blob.size;
   if(total>300*1048576)throw new Error("Expanded contents exceed the 300 MiB memory protection limit");
   if(blob.size!==item.size)throw new Error("File size mismatch: "+item.path);
   files.push({path:item.path,blob});
  }
  const intoDir=$("arcToFolder").checked&&"showDirectoryPicker" in window;
  if(intoDir){await saveToDirectory(files);}
  else if(files.length===1){saveBlob(files[0].blob,simpleName(files[0].path));}
  else{
   const f=await writeArchive(files.map(x=>({file:x.blob,pathname:x.path})),"zip",outputName($("arcSource").files[0])+"-extracted");
   saveBlob(f,outputName($("arcSource").files[0])+"-extracted.zip");
  }
  message(tr("restored")+"\n"+files.length+" "+tr("filesLabel")+" · "+displayBytes(total));
 }catch(e){message(e.message||String(e),true);}
 finally{setBusy(false);}
});
langSelect.addEventListener("change",translateArchive);
translateArchive();
refreshInputCount();
$("arcArchiveSummary").textContent=tr("noArchive");
})();

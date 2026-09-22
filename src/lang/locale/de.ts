// Deutsch

export default {
  'Retry': 'Erneut versuchen',

  // src/settings.ts
  'Path to bibliography file': 'Pfad zur Bibliographie-Datei',
  'The absolute path to your desired bibliography file. This can be overridden on a per-file basis by setting "bibliography" in the file\'s frontmatter.':
    'Der absolute Pfad zu deiner Literaturverzeichnisdatei. Dies kann für jede einzelne Notiz überschrieben werden, indem du „bibliography“ im Frontmatter der Notiz festlegst.',
  'Select a bibliography file.': 'Bibliographie-Datei auswählen.',
  'Custom citation style': 'Eigener Zitationsstil',
  'Citation style': 'Zitationsstil',
  'Citation style language': 'Sprache des Zitationsstils',
  'This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file\'s frontmatter. A language code must be used when setting the language via frontmatter.':
    'Dies kann für einzelne Dateien überschrieben werden, indem du „lang“ oder „citation-language“ im Frontmatter der Notiz festlegst. Bei der Festlegung der Sprache über den Frontmatter muss ein Sprachcode verwendet werden.',
  'Search...': 'Suchen...',
  'Path to a CSL file. This can be an absolute path or one relative to your vault. This will override the style selected above. This can be overridden on a per-file basis by setting "csl" or "citation-style" in the file\'s frontmatter. A URL can be supplied when setting the style via frontmatter.':
    'Pfad zu einer CSL-Datei. Das kann ein absoluter Pfad oder ein relativer Pfad zu deinem Vault sein. Damit wird der oben ausgewählte Stil überschrieben. Dies kann für einzelne Notizen überschrieben werden, indem im Frontmatter der Notiz „csl“ oder „citation-style“ angegeben wird. Bei der Festlegung des Stils über den Frontmatter kann eine URL angegeben werden.',
  'Select a CSL file located on your computer':
    'Wähle eine CSL-Datei auf deinem Computer aus',
  'Fallback path to Pandoc': 'Fallback-Pfad zu Pandoc',
  "The absolute path to the Pandoc executable. This plugin will attempt to locate pandoc for you and will use this path if it fails to do so. To find pandoc, use the output of 'which pandoc' in a terminal on Mac/Linux or 'Get-Command pandoc' in powershell on Windows.":
    "Der absolute Pfad zur Pandoc-Executable. Dieses Plugin versucht, Pandoc für dich zu finden, und verwendet diesen Pfad, falls dies nicht gelingt. Um Pandoc zu finden, gib in einem Terminal unter Mac/Linux den Befehl „which pandoc“ ein oder unter Windows in PowerShell den Befehl „Get-Command pandoc“.",
  'Attempt to find Pandoc automatically':
    'Versuche Pandoc automatisch zu finden',
  'Unable to find pandoc on your system. If it is installed, please manually enter a path.':
    'Konnte Pandoc nicht finden. Falls es installiert ist, gib den Pfad manuell ein.',
  'Hide links in references': 'Links in Literaturverzeichnis verstecken',
  'Replace links with link icons to save space.':
    'Ersetze Links durch Link-Icons, um Platz zu sparen.',
  'Show citekey tooltips': 'Zeige Citekey-Tooltips',
  'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.':
    'Wenn diese Funktion aktiviert ist, öffnet sich beim Bewegen des Mauszeigers über Citekeys ein Tooltip mit der Zitation.',
  'Tooltip delay': 'Tooltip Delay',
  'Set the amount of time (in milliseconds) to wait before displaying tooltips.':
    'Zeit (in Millisekunden) bevor Tooltips angezeigt werden.',
  'Validate Pandoc configuration': 'Pandoc-Konfiguration überprüfen',
  'Validate': 'Überprüfen',
  'Validation successful': 'Überprüfung erfolgreich',
  'Show citekey suggestions': 'Zitiervorschläge anzeigen',
  'When enabled, an autocomplete dialog will display when typing citation keys.':
    'Zeigt Vorschläge an wenn Citation keys eingegeben werden.',
  'Pull bibliography from Zotero': 'Bibliography von Zotero abrufen',
  'When enabled, bibliography data will be pulled from Zotero rather than a bibliography file.':
    'Literaturangaben aus Zotero statt aus einer Literaturdatei abrufen.',
  'Zotero port': 'Zotero Port',
  "Use 24119 for Juris-M or specify a custom port if you have changed Zotero's default.":
    "Nutze 24119 für Juris-M oder gib einen anderen Port an, falls du ihn in Zotero geändert hast.",
  'Citation settings': 'Zitations-Einstellungen',
    'Render live preview inline citations':
    'Zitationen im Live-Preview rendern',
  'Render reading mode inline citations':
    'Zitationen im Lesemodus rendern',
  'Convert [@pandoc] citations to formatted inline citations in live preview mode.':
    'Wandle [@pandoc]-Zitate im Live-Vorschau-Modus in formatierte Inline-Zitate um.',
  'Convert [@pandoc] citations to formatted inline citations in reading mode.':
    'Wandelt [@pandoc]-Zitate im Lesemodus in formatierte Inline-Zitate um.',
  'Process citations in links': 'Zitate innerhalb von Links verarbeiten',
  'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.':
    'Füge [[@pandoc]]-Zitate in das Literaturverzeichnis ein und formatier sie im Live-Vorschau-Modus als Inline-Zitate.',
  
    // src/view.ts
  'Click to copy': 'Klicken zum Kopieren',
  'Copy list': 'Alle kopieren',
  'No citations found in the current document.':
    'Keine Einträge im geöffneten Dokument.',
  'References': 'Literaturverzeichnis',
  'Cannot connect to Zotero': 'Verbindung mit Zotero nicht möglich',
  'Start Zotero and try again.': 'Start Zotero and try again.',
  'Please check your Pandoc Reference List plugin settings.':
    'Bitte überprüfe die Einstellungen des Pandoc Reference List Plugins.',
  'Refresh bibliography': 'Bibliographie neu laden',
  'Pandoc reference list settings': 'Pandoc reference list settings',
  
  // src/tooltip.ts
  'No citation found for ': 'Nichts gefunden für ',

  // src/main.ts
  'Show reference list': 'Literaturverzeichnis anzeigen',

  // src/view.ts
  'Open literature note': 'Open literature note',
  'Open in Zotero': 'In Zotero anzeigen',
  'Open file in Zotero': 'Datei in Zotero öffnen',
};


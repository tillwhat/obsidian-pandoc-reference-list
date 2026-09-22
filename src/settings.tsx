import {
  AbstractInputSuggest,
  Notice,
  PluginSettingTab,
  Platform,
  Setting,
  SettingDefinitionItem,
  SettingDefinitionRender,
  TextComponent,
} from 'obsidian';
import { t } from './lang/helpers';
import ReferenceList from './main';
import { DEFAULT_ZOTERO_PORT, getZUserGroups } from './bib/helpers';
import { cslList, cslListRaw } from './bib/cslList';
import { langList, langListRaw } from './bib/cslLangList';

interface SearchOption {
  label: string;
  value: string;
}

class OptionSuggest extends AbstractInputSuggest<SearchOption> {
  constructor(
    app: ReferenceList['app'],
    inputEl: HTMLInputElement,
    private readonly search: (query: string) => SearchOption[],
    private readonly onSelectOption: (option: SearchOption) => void
  ) {
    super(app, inputEl);
  }

  getSuggestions(query: string) {
    return this.search(query).slice(0, 100);
  }

  renderSuggestion(option: SearchOption, el: HTMLElement) {
    el.setText(option.label);
  }

  selectSuggestion(option: SearchOption) {
    this.setValue(option.label);
    this.onSelectOption(option);
    this.close();
  }
}

export const DEFAULT_SETTINGS: ReferenceListSettings = {
  pathToPandoc: '',
  tooltipDelay: 400,
  zoteroGroups: [],
  renderCitations: true,
  renderCitationsReadingMode: true,
  renderLinkCitations: true,
};

export interface ZoteroGroup {
  id: number;
  name: string;
  lastUpdate?: number;
}

export interface ReferenceListSettings {
  pathToPandoc: string;
  pathToBibliography?: string;

  cslStyleURL?: string;
  cslStylePath?: string;
  cslLang?: string;

  hideLinks?: boolean;
  showCitekeyTooltips?: boolean;
  tooltipDelay: number;
  enableCiteKeyCompletion?: boolean;
  renderCitations?: boolean;
  renderCitationsReadingMode?: boolean;
  renderLinkCitations?: boolean;

  pullFromZotero?: boolean;
  zoteroPort?: string;
  zoteroGroups: ZoteroGroup[];
}

export class ReferenceListSettingsTab extends PluginSettingTab {
  plugin: ReferenceList;
  private zoteroConnected = false;
  private zoteroGroups: ZoteroGroup[] = [];

  constructor(plugin: ReferenceList) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  async refreshZoteroGroups() {
    try {
      const groups = await getZUserGroups(
        this.plugin.settings.zoteroPort ?? DEFAULT_ZOTERO_PORT
      );
      if (!groups) {
        throw new Error('Zotero is not available.');
      }
      this.zoteroGroups = groups;
      const validIds = new Set(this.zoteroGroups.map((group) => group.id));
      const previousGroups = this.plugin.settings.zoteroGroups;
      const nextGroups =
        previousGroups.filter((group) =>
          validIds.has(group.id)
        );
      this.plugin.settings.zoteroGroups = nextGroups;
      this.zoteroConnected = true;
      if (nextGroups.length !== previousGroups.length) {
        await this.plugin.saveSettings();
      }
    } catch {
      this.zoteroConnected = false;
    }
    this.update();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const renderTextSetting = (
      key: 'pathToPandoc' | 'pathToBibliography' | 'cslStylePath',
      onChange?: () => void
    ): Pick<SettingDefinitionRender, 'render'> => ({
      render: (setting: Setting) => {
        setting.addText((text) =>
          text
            .setValue(this.plugin.settings[key] ?? '')
            .onChange((value: string) => {
              const previous = this.plugin.settings[key];
              this.plugin.settings[key] = value;
              void this.plugin.saveSettings(() => {
                if (key === 'pathToBibliography' && previous) {
                  this.plugin.bibManager.clearWatcher(previous);
                }
                onChange?.();
              });
            })
        );
      },
    });
    const renderToggleSetting = (
      key:
        | 'hideLinks'
        | 'renderCitations'
        | 'renderCitationsReadingMode'
        | 'renderLinkCitations'
        | 'enableCiteKeyCompletion'
        | 'showCitekeyTooltips'
    ): Pick<SettingDefinitionRender, 'render'> => ({
      render: (setting: Setting) => {
        setting.addToggle((toggle) =>
          toggle.setValue(!!this.plugin.settings[key]).onChange((value) => {
            this.plugin.settings[key] = value;
            void this.plugin.saveSettings();
          })
        );
      },
    });
    const renderSliderSetting: Pick<SettingDefinitionRender, 'render'> = {
      render: (setting: Setting) => {
        setting.addSlider((slider) =>
          slider
            .setDynamicTooltip()
            .setLimits(0, 7000, 100)
            .setValue(this.plugin.settings.tooltipDelay)
            .onChange((value) => {
              this.plugin.settings.tooltipDelay = value;
              void this.plugin.saveSettings();
            })
        );
      },
    };

    const desktopOnly = () => !Platform.isMobile;

    return [
      {
        name: t('Fallback path to Pandoc'),
        visible: desktopOnly,
        desc: t(
          "The absolute path to the Pandoc executable. This plugin will attempt to locate pandoc for you and will use this path if it fails to do so. To find pandoc, use the output of 'which pandoc' in a terminal on Mac/Linux or 'Get-Command pandoc' in powershell on Windows."
        ),
        render: (setting: Setting) => {
          let input: TextComponent;
          setting.addText((text) => {
            input = text;
            text
              .setValue(this.plugin.settings.pathToPandoc ?? '')
              .onChange((value: string) => {
                this.plugin.settings.pathToPandoc = value;
                void this.plugin.saveSettings();
              });
          });
          setting.addExtraButton((button) => {
            button
              .setIcon('magnifying-glass')
              .setTooltip(t('Attempt to find Pandoc automatically'))
              .onClick(async () => {
                try {
                  if (Platform.isMobile) return;
                  const { findExecutable } = await import('./desktopHelpers');
                  const pathToPandoc = findExecutable('pandoc');
                  if (!pathToPandoc) throw new Error('Pandoc was not found.');
                  input.setValue(pathToPandoc);
                  this.plugin.settings.pathToPandoc = pathToPandoc;
                  await this.plugin.saveSettings();
                } catch (error) {
                  new Notice(
                    t(
                      'Unable to find pandoc on your system. If it is installed, please manually enter a path.'
                    )
                  );
                  console.error(error);
                }
              });
          });
        },
      },
      {
        name: t('Path to bibliography file'),
        visible: desktopOnly,
        desc: t(
          'The absolute path to your desired bibliography file. This can be overridden on a per-file basis by setting "bibliography" in the file\'s frontmatter.'
        ),
        ...renderTextSetting('pathToBibliography', () =>
          this.plugin.bibManager.reinit(true)
        ),
      },
      {
        type: 'group',
        heading: 'Zotero',
        cls: 'pwc-zotero-settings',
        items: [
          {
            name: t('Pull bibliography from Zotero'),
            visible: desktopOnly,
            desc: t(
              'When enabled, bibliography data will be pulled from Zotero rather than a bibliography file.'
            ),
            render: (setting: Setting) => {
              setting.addToggle((toggle) =>
                toggle
                  .setValue(!!this.plugin.settings.pullFromZotero)
                  .onChange(async (value) => {
                    this.plugin.settings.pullFromZotero = value;
                    if (
                      value &&
                      this.zoteroConnected &&
                      !this.plugin.settings.zoteroGroups.length
                    ) {
                      const myLibrary = this.zoteroGroups.find(
                        (group) => group.id === 1
                      );
                      if (myLibrary) {
                        this.plugin.settings.zoteroGroups = [myLibrary];
                      }
                    }
                    await this.plugin.saveSettings(() =>
                      this.plugin.bibManager.reinit(true)
                    );
                    this.update();
                  })
              );
            },
          },
          {
            name: t('Cannot connect to Zotero'),
            desc: t('Start Zotero and try again.'),
            visible: () => desktopOnly() && !this.zoteroConnected,
            render: (setting: Setting) => {
              setting.addButton((button) =>
                button
                  .setButtonText(t('Retry'))
                  .setCta()
                  .onClick(() => this.refreshZoteroGroups())
              );
            },
          },
          {
            name: t('Zotero port'),
            desc: t(
              "Use 24119 for Juris-M or specify a custom port if you have changed Zotero's default."
            ),
            visible: () => desktopOnly() && !!this.plugin.settings.pullFromZotero,
            render: (setting: Setting) => {
              setting.addText((text) =>
                text
                  .setValue(
                    this.plugin.settings.zoteroPort ?? DEFAULT_ZOTERO_PORT
                  )
                  .onChange(async (value) => {
                    this.plugin.settings.zoteroPort = value;
                    await this.plugin.saveSettings();
                    await this.refreshZoteroGroups();
                  })
              );
            },
          },
          ...this.zoteroGroups.map((group) => ({
            name: group.name,
            visible: () =>
              desktopOnly() &&
              !!this.plugin.settings.pullFromZotero &&
              this.zoteroConnected,
            render: (setting: Setting) => {
              setting.addToggle((toggle) =>
                toggle
                  .setValue(
                    this.plugin.settings.zoteroGroups.some(
                      (selected) => selected.id === group.id
                    )
                  )
                  .onChange(async (value) => {
                    this.plugin.settings.zoteroGroups = value
                      ? [...this.plugin.settings.zoteroGroups, group]
                      : this.plugin.settings.zoteroGroups.filter(
                          (selected) => selected.id !== group.id
                        );
                    await this.plugin.saveSettings(() =>
                      this.plugin.bibManager.reinit(true)
                    );
                  })
              );
            },
          })),
        ],
      },
      {
        name: t('Reference list sidebar'),
        desc: t('Add or reveal the reference list in the right sidebar.'),
        render: (setting: Setting) => {
          setting.addButton((button) =>
            button
              .setButtonText(t('Show reference list'))
              .onClick(() => void this.plugin.initLeaf())
          );
        },
      },
      {
        type: 'group',
        heading: t('Citation settings'),
        items: [
          {
            name: t('Citation style'),
            render: (setting: Setting) => {
              const selected = cslListRaw.find(
                (item) => item.value === this.plugin.settings.cslStyleURL
              );
              setting.addSearch((search) => {
                search
                  .setPlaceholder(t('Search...'))
                  .setValue(selected?.label ?? '')
                  .onChange((value) => {
                    if (!value) {
                      this.plugin.settings.cslStyleURL = undefined;
                      void this.plugin.saveSettings(() =>
                        this.plugin.bibManager.reinit(false)
                      );
                    }
                  });
                new OptionSuggest(
                  this.plugin.app,
                  search.inputEl,
                  (query) =>
                    cslList.search(query).map((result) => ({
                      label: result.item.label,
                      value: result.item.value,
                    })),
                  (option) => {
                    this.plugin.settings.cslStyleURL = option.value;
                    void this.plugin.saveSettings(async () => {
                      await this.plugin.bibManager.reinit(false);
                      this.plugin.processReferences();
                    });
                  }
                );
              });
            },
          },
          {
            name: t('Custom citation style'),
            desc: t(
              'Path to a CSL file. This can be an absolute path or one relative to your vault. This will override the style selected above. This can be overridden on a per-file basis by setting "csl" or "citation-style" in the file\'s frontmatter. A URL can be supplied when setting the style via frontmatter.'
            ),
            ...renderTextSetting('cslStylePath', () =>
              this.plugin.bibManager.reinit(false)
            ),
          },
          {
            name: t('Citation style language'),
            desc: t(
              'This can be overridden on a per-file basis by setting "lang" or "citation-language" in the file\'s frontmatter. A language code must be used when setting the language via frontmatter.'
            ),
            render: (setting: Setting) => {
              const selected = langListRaw.find(
                (item) => item.value === this.plugin.settings.cslLang
              );
              setting.addSearch((search) => {
                search
                  .setPlaceholder(t('Search...'))
                  .setValue(selected?.label ?? '')
                  .onChange((value) => {
                    if (!value) {
                      this.plugin.settings.cslLang = undefined;
                      void this.plugin.saveSettings(() =>
                        this.plugin.bibManager.reinit(false)
                      );
                    }
                  });
                new OptionSuggest(
                  this.plugin.app,
                  search.inputEl,
                  (query) =>
                    langList.search(query).map((result) => ({
                      label: result.item.label,
                      value: result.item.value,
                    })),
                  (option) => {
                    this.plugin.settings.cslLang = option.value;
                    void this.plugin.saveSettings(async () => {
                      await this.plugin.bibManager.reinit(false);
                      this.plugin.processReferences();
                    });
                  }
                );
              });
            },
          },
          {
            name: t('Hide links in references'),
            desc: t('Replace links with link icons to save space.'),
            ...renderToggleSetting('hideLinks'),
          },
          {
            name: t('Render live preview inline citations'),
            desc: t(
              'Convert [@pandoc] citations to formatted inline citations in live preview mode.'
            ),
            ...renderToggleSetting('renderCitations'),
          },
          {
            name: t('Render reading mode inline citations'),
            desc: t(
              'Convert [@pandoc] citations to formatted inline citations in reading mode.'
            ),
            ...renderToggleSetting('renderCitationsReadingMode'),
          },
          {
            name: t('Process citations in links'),
            desc: t(
              'Include [[@pandoc]] citations in the reference list and format them as inline citations in live preview mode.'
            ),
            ...renderToggleSetting('renderLinkCitations'),
          },
          {
            name: t('Show citekey suggestions'),
            desc: t(
              'When enabled, an autocomplete dialog will display when typing citation keys.'
            ),
            ...renderToggleSetting('enableCiteKeyCompletion'),
          },
          {
            name: t('Show citekey tooltips'),
            desc: t(
              'When enabled, hovering over citekeys will open a tooltip containing a formatted citation.'
            ),
            ...renderToggleSetting('showCitekeyTooltips'),
          },
          {
            name: t('Tooltip delay'),
            desc: t(
              'Set the amount of time (in milliseconds) to wait before displaying tooltips.'
            ),
            ...renderSliderSetting,
          },
        ]
      }
    ];
  }
}

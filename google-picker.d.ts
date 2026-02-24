// Type declarations for Google Picker API (loaded via gapi)
declare var gapi: {
  load(api: string, callbacks: { callback: () => void; onerror?: () => void }): void;
};

declare namespace google.picker {
  enum ViewId {
    DOCS = 'all',
    DOCS_IMAGES = 'docs-images',
    DOCS_VIDEOS = 'docs-videos',
    SPREADSHEETS = 'spreadsheets',
    FOLDERS = 'folders',
  }

  enum Action {
    PICKED = 'picked',
    CANCEL = 'cancel',
    LOADED = 'loaded',
  }

  enum Feature {
    MULTISELECT_ENABLED = 'multiselect',
    NAV_HIDDEN = 'navhidden',
  }

  interface Document {
    id: string;
    name: string;
    mimeType: string;
    url: string;
    sizeBytes?: number;
  }

  interface ResponseObject {
    action: Action;
    docs: Document[];
  }

  class DocsView {
    constructor(viewId?: ViewId);
    setMimeTypes(mimeTypes: string): DocsView;
    setIncludeFolders(include: boolean): DocsView;
    setSelectFolderEnabled(enabled: boolean): DocsView;
    setParent(folderId: string): DocsView;
    setMode(mode: any): DocsView;
  }

  class PickerBuilder {
    constructor();
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    addView(view: DocsView | ViewId): PickerBuilder;
    setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
    enableFeature(feature: Feature): PickerBuilder;
    disableFeature(feature: Feature): PickerBuilder;
    build(): Picker;
  }

  class Picker {
    setVisible(visible: boolean): void;
    dispose(): void;
  }
}

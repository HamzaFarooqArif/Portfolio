export class LoadingUtil {

  private static loadingRegistry: {componentName: string, loading: boolean}[] = [];
  private static statusChanged: boolean = false;
  private static loading = false;

  constructor() { }

  public static setStatus(componentName: string, loading: boolean) {
    if (!LoadingUtil.loadingRegistry.some(item => item.componentName.toLowerCase() === componentName.toLowerCase())) {
      LoadingUtil.loadingRegistry.push(
        {
          componentName: componentName,
          loading: loading
        }
      );
      LoadingUtil.statusChanged = true;
    }
    else {
      let item = LoadingUtil.loadingRegistry.find(x => x.componentName.toLowerCase() === componentName.toLowerCase());
      if(item) {
        item.loading = loading;
      }
      LoadingUtil.statusChanged = true;
    }
  }

  public static isLoading() {
    if(LoadingUtil.statusChanged) {
      LoadingUtil.loading = LoadingUtil.loadingRegistry.some(x => x.loading);
      LoadingUtil.statusChanged = false;
    }
    return LoadingUtil.loading;
  }
}

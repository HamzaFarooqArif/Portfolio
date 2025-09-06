export class Utils {
    public static isEmpty = (obj: any): boolean => {
        return obj && typeof obj === 'object' && Object.keys(obj).length === 0;
    };

    public static delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


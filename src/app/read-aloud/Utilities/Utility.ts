export class Utility {
    public static isEmpty = (obj: any): boolean => {
        return obj && typeof obj === 'object' && Object.keys(obj).length === 0;
    };
}


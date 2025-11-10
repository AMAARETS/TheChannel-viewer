export interface Site {
  name: string;
  url: string;
  googleLoginSupported: boolean;
}

export interface Category {
  name: string;
  sites: Site[];
}

export interface AvailableSite extends Site {
  description: string;
  category: string;
}

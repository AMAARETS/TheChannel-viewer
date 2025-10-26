export interface Site {
  name: string;
  url: string;
}

export interface Category {
  name: string;
  sites: Site[];
}

export interface AvailableSite extends Site {
  description: string;
  category: string;
}

export interface FotoDrive {
  id: string;
  name: string;
  resourceKey?: string;
}

export interface FotoDrivePanel extends FotoDrive {
  miniaturaUrl?: string;
  descargaUrl?: string;
}

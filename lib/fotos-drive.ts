export interface FotoDrive {
  id: string;
  name: string;
  resourceKey?: string;
  miniaturaDrive?: string;
}

export interface FotoDrivePanel extends FotoDrive {
  miniaturaUrl?: string;
  descargaUrl?: string;
}

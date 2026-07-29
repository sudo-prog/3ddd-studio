export type PanelDef = {
  meshName: string;
  materialName?: string;
  uvRect: { u0: number; v0: number; u1: number; v1: number };
  textureSize: number;
};

export type GarmentPanelConfig = {
  front?: PanelDef;
  back?: PanelDef;
  left_arm?: PanelDef;
  right_app?: PanelDef;
};

export const GARMENT_PANELS: Record<string, GarmentPanelConfig> = {
  'seed-t-shirt-hoodie': {
    front: {
      meshName: 'Body_Front',
      uvRect: { u0: 0, v0: 0, u1: 1, v1: 1 },
      textureSize: 2048,
    },
  },
};

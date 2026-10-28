import { themes } from '../app.constants';

export type Settings = {
  theme: keyof typeof themes;
  profileId: string;
  fontFamily: string;
  fontSize: number;
  scale: number;
  backgroundOpacity: number;
};

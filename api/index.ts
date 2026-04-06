import { initApp } from "../server/index";

export default async (req: any, res: any) => {
  const { app } = await initApp();
  return app(req, res);
};

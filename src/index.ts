import { Probot } from 'probot';

import { firstTimeGreetingsHandler } from './firstTimeGreetings';
import { secretValuesHandler } from './secretValues';

export = (app: Probot) => {
  app = firstTimeGreetingsHandler(app);
  app = secretValuesHandler(app);
};

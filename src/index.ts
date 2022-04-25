import { Probot } from 'probot';

import { secretValuesHandler } from './secretValues';

export = (app: Probot) => {
  app = secretValuesHandler(app);
};

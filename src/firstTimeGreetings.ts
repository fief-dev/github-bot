import { Probot } from 'probot';
import type { User } from "@octokit/webhooks-types";

const getComment = (sender: User): string => {
  return `
Hail, @${sender.login} 👋 Welcome to Fief's kingdom!

Our team will get back to you very soon to help.

In the meantime, take a minute to star our repository ⭐️

![star-fief](https://user-images.githubusercontent.com/1144727/192523552-dc2c31fa-ae94-42fa-9ab4-7d0ba51bb7b0.png)

Farewell!
`.trim();
};

export const firstTimeGreetingsHandler = (app: Probot): Probot => {
  app.on(["issues.opened"], async (context) => {
    if (context.isBot) return;
    if (context.payload.issue.author_association !== 'FIRST_TIMER') return;

    const issueComment = context.issue({ body: getComment(context.payload.issue.user) });
    await context.octokit.issues.createComment(issueComment);
  });

  app.on(["discussion.created"], async (context) => {
    if (context.isBot) return;
    if (context.payload.discussion.author_association !== 'FIRST_TIMER') return;

    const graphql = context.octokit.graphql;
    await graphql({
      query: `
        mutation($discussionId: ID!, $body: String!) {
          addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
            clientMutationId
          }
        }
      `,
      discussionId: context.payload.discussion.node_id,
      body: getComment(context.payload.discussion.user),
    });
  });

  return app;
};

import { Probot } from "probot";
import type { User } from "@octokit/webhooks-types";
import { graphql as globalGraphql } from "@octokit/graphql";

const getComment = (sender: User): string => {
  return `
Hail, @${sender.login} 👋 Welcome to Fief's kingdom!

Our team will get back to you very soon to help.

In the meantime, take a minute to [star our repository](https://github.com/fief-dev/fief) ⭐️

<p align="center">
<img width="656" alt="star-fief" src="https://github.com/fief-dev/fief/assets/1144727/b2db7f59-102f-47e5-9751-67fa10372c52">
</p>

Farewell!
`.trim();
};

const isFirstTimePoster = async (
  user: User,
  graphql: typeof globalGraphql,
): Promise<boolean> => {
  const {
    search: { issueCount },
  } = (await graphql({
    query: `
      query countDiscussions($countQuery: String!) {
        search(query: $countQuery, type: ISSUE) {
          issueCount
        }
      }
    `,
    countQuery: `author:${user.login} repo:fief-dev/fief`,
  })) as any;

  const {
    search: { discussionCount },
  } = (await graphql({
    query: `
      query countDiscussions($countQuery: String!) {
        search(query: $countQuery, type: DISCUSSION) {
          discussionCount
        }
      }
    `,
    countQuery: `author:${user.login} repo:fief-dev/fief`,
  })) as any;

  return issueCount + discussionCount === 1;
};

export const firstTimeGreetingsHandler = (app: Probot): Probot => {
  app.on(["issues.opened"], async (context) => {
    if (context.isBot) return;

    const user = context.payload.issue.user;
    if (!(await isFirstTimePoster(user, context.octokit.graphql))) return;

    const issueComment = context.issue({
      body: getComment(context.payload.issue.user),
    });
    await context.octokit.issues.createComment(issueComment);
  });

  app.on(["discussion.created"], async (context) => {
    if (context.isBot) return;

    const graphql = context.octokit.graphql;
    const user = context.payload.discussion.user;

    if (!(await isFirstTimePoster(user, graphql))) return;

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

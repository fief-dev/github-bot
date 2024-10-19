import { Probot } from 'probot';
import type { User } from '@octokit/webhooks-types';

const SECRET_VALUES_REGEX = new RegExp(/(SECRET|ENCRYPTION_KEY|FIEF_CLIENT_ID|FIEF_CLIENT_SECRET)\s*=\s*([\w\-]+)/, 'img');

type SensitiveValues = { name: string, value: string, full_match: string }[];

const isDummyValue = (value: string): boolean => {
  const lowercaseValue = value.toLowerCase();
  const allCharsEqual = lowercaseValue.split('').every((char) => char === lowercaseValue[0]);

  return allCharsEqual;
};

const getSecretValues = (text: string): SensitiveValues => {
  let result: SensitiveValues = [];
  for (const match of text.matchAll(SECRET_VALUES_REGEX)) {
    if (!isDummyValue(match[2])) {
      result.push({ name: match[1], value: match[2], full_match: match[0] });
    }
  }
  return result;
};

const getUpdatedText = (text: string, sensitiveValues: SensitiveValues): string => {
  let updatedText = text;
  for (const sensitiveValue of sensitiveValues) {
    updatedText = updatedText.replace(sensitiveValue.value, 'XXX');
  }
  return updatedText;
};

const getComment = (sensitiveValues: SensitiveValues, sender: User): string => {
  return `
Hail, @${sender.login} 👋

I've noticed you shared secret values: ${sensitiveValues.map(({ name }) => `\`${name}\``).join(', ')}. Those are highly sensitive and you should keep them secret.

For your security, I've taken the liberty to replace them with dummy values.

> [!IMPORTANT]
> Since GitHub shows comments history publicly, I recommend you to delete the old revision as described [here](https://docs.github.com/en/communities/moderating-comments-and-conversations/tracking-changes-in-a-comment#deleting-sensitive-information-from-a-comments-history).
`.trim();
};

export const secretValuesHandler = (app: Probot): Probot => {
  app.on(["issues.opened", "issues.edited"], async (context) => {
    if (context.isBot) return;

    const body = context.payload.issue.body;
    if (body === null) {
      return;
    }
    const sensitiveValues = getSecretValues(body);
    if (sensitiveValues.length > 0) {
      const issueEdition = context.issue({ body: getUpdatedText(body, sensitiveValues) });
      await context.octokit.issues.update(issueEdition);

      const issueComment = context.issue({ body: getComment(sensitiveValues, context.payload.issue.user) });
      await context.octokit.issues.createComment(issueComment);
    }
  });

  app.on(["issue_comment.created", "issue_comment.edited"], async (context) => {
    if (context.isBot) return;

    const body = context.payload.comment.body;
    const sensitiveValues = getSecretValues(body);
    if (sensitiveValues.length > 0) {
      const commentEdition = context.issue({ comment_id: context.payload.comment.id, body: getUpdatedText(body, sensitiveValues) });
      await context.octokit.issues.updateComment(commentEdition);

      const issueComment = context.issue({ body: getComment(sensitiveValues, context.payload.comment.user) });
      await context.octokit.issues.createComment(issueComment);
    }
  });

  app.on(["discussion.created", "discussion.edited"], async (context) => {
    if (context.isBot) return;

    const body = context.payload.discussion.body;
    const sensitiveValues = getSecretValues(body);
    if (sensitiveValues.length > 0) {
      const graphql = context.octokit.graphql;
      await graphql({
        query: `
          mutation($discussionId: ID!, $body: String!) {
            updateDiscussion(input: { discussionId: $discussionId, body: $body }) {
              clientMutationId
            }
          }
        `,
        discussionId: context.payload.discussion.node_id,
        body: getUpdatedText(body, sensitiveValues),
      });

      await graphql({
        query: `
          mutation($discussionId: ID!, $body: String!) {
            addDiscussionComment(input: { discussionId: $discussionId, body: $body }) {
              clientMutationId
            }
          }
        `,
        discussionId: context.payload.discussion.node_id,
        body: getComment(sensitiveValues, context.payload.discussion.user),
      });
    }
  });

  app.on(["discussion_comment.created", "discussion_comment.edited"], async (context) => {
    if (context.isBot) return;

    const body = context.payload.comment.body;
    const sensitiveValues = getSecretValues(body);
    if (sensitiveValues.length > 0) {
      const graphql = context.octokit.graphql;
      await graphql({
        query: `
          mutation($commentId: ID!, $body: String!) {
            updateDiscussionComment(input: { commentId: $commentId, body: $body }) {
              clientMutationId
            }
          }
        `,
        commentId: context.payload.comment.node_id,
        body: getUpdatedText(body, sensitiveValues),
      });

      await graphql({
        query: `
          mutation($discussionId: ID!, $replyToId: ID!, $body: String!) {
            addDiscussionComment(input: { discussionId: $discussionId, replyToId: $replyToId, body: $body}) {
              clientMutationId
            }
          }
        `,
        discussionId: context.payload.discussion.node_id,
        replyToId: context.payload.comment.node_id,
        body: getComment(sensitiveValues, context.payload.comment.user),
      });
    }
  });

  return app;
};

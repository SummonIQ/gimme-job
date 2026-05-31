import { getModels, type AiProvider } from '@/lib/ai/models';
import { generateText } from 'ai';

export async function reviseMarkdown(
  markdown: string,
  options: { readonly aiProvider?: AiProvider } = {},
): Promise<string> {
  const prompt = `
  You are an expert in correcting and improving Markdown formatting.
  1. Ensure that extraneous table formatting is removed.
  2. Ensure that headings are formatted accordingly based on the level of the heading.
    - The top level heading should be #
    - The second level heading should be ##
    - The third level heading should be ###
    - The fourth level heading should be ####
    - The fifth level heading should be #####
    - The sixth level heading should be ######
    - Prefer to use the # symbol for headings over "**"
    - Ensure that the hierarchy of headings is correct.
  3. Ensure that the markdown is formatted correctly.
  4. Preserve page breaks marked by a line containing only "---".
  5. Remove footer-only page labels such as "Page 1 of 5"; never turn those labels into headings.
  6. Do not include any other text in the response. Including things like '\`\`\`markdown\`\`\` or "\`\`\`'
  Markdown:
  ${markdown}
  `;

  const { text } = await generateText({
    model: getModels(options.aiProvider).fast,
    prompt,
    system: 'You are a helpful assistant.',
  });

  return text;
}

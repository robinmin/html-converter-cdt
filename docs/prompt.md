# prompt

## 1, Core requirements to develop the library
`@docs/pdf-export.mjs` is a JavaScript module that exports a function to convert HTML content to a PDF file with playwright, as a prototype.

Now I need to design a set of APIs to convert HTML content(including local html files and remote html files) to several formats, including:
- mhtml
- Markdown
- PDF
- PNG
- JPEG
- docx

To ensure all external resources are loaded properly, we need to save them as a single mhtml file locally first, then convert this file into the format we want. This is another difference from the prototype(so far, the prototype is not yet implemented).

And, as I plan to use this library to develop some chrome extensions, so we can not use playwright anymore as the prototype did. But we can use Chrome DevTools Protocol to achieve this directly.

Meanwhile, as I also need to provide command line support once the end user installs this library. For example, the end user can use `npx html-converter-cdt` to convert HTML content to PDF, Markdown, PNG, JPEG, and docx formats.

I need your help to review and improve the design of the library, and generate PRD document into @docs/prd.md. You need to fully understand the requirements and get everything clear before starting to design. In case of any ambiguity or unclear, please ask me for clarification.

Let's rock!

=======

1, No need to implement the chrome extension in this project. We will use current project as a dependency library to build the Chrome Extension separately.

2, Use mermaid to generate diagrams to show the architecture of the library and ER diagram for these key componens.

3, Add a list of key external dependencies with brief and versions as a appendix. We need to review them all first.

4, For your open questions:
  - 4. Should we provide a browser-only build (no Node.js)? : No.
  - 5. Configuration file format: JS, JSON, or both? : JSON.
  - 6. Should we support older Node.js versions (16.x)? : No.

=======

## Update PRD
Here comes two review points by another team mates: @docs/review1.md and docs/review2.md. And another updated sample of PRD file @docs/prd.v1.0.1.md. Help to
- consolidate all of these review points and generate a final PRD document(@docs/prdv2.md) without too much details. Be careful to avoid any mistakes or miss any details.
- Meanwhile, we do not need to loose the details -- we will based these existing details and the updated new PRD document, generate the FSD(Functional Specification Document) document(@docs/fsdv2.md).
- The FSD document for the library should include the architecture, design patterns, folder structure, and implementation details and etc.

In case of any ambiguity or unclear, please ask me for clarification.

## Generate AGENTS.md
### First round
Based on the spec. on https://AGENTS.md and your understanding for current project, help to generate a comprehensive instructions for AI coding agents(for example Claude Code like you) to have better cooperation for the following works together into @docs/AGENTS.md .

### Second round
Based on the generated @docs/AGENTS.md, help to enhance the following points:
- 1, There are so many redundant information we do not need theem as a AGEENTS.md file. Help to cleanup them all to save the tokens. The key lies in maintaining precision and conciseness while avoiding any ambiguity. - 2, Add a section 'Key Principles' at the begining of the document, I will add the core key principles here and force every agent must follow up when they start to work on it. You can intiative a list, I will fine tune them based on it. You can take this opportunity to centralize the key principles you have but just embeded them into the document.
- 3, I prefer to use task-master(command line or MCP) to manage the tasks. so you'd better to told agents they need to:
  - Update the task's status as WIP once they start to work on it;
  - Update the task's status as finished once they successfully completed the task.

### Third round
Here comes the new enhancements requirements:
- I added a new section 'Philosophical Principles for All' before all the Principles your prepared. They are more abstract, more like principles than involving specific matters.
- I also added a section 'MCP Integration' and add the relevant instructions for MCP 'Context7'. You can add MCP 'task-master' instructions here.
- I also added a section 'Essential Commands'. I need you centralize all key commands here with a brief explanation.

This structure will help agents to better understand and follow the instructions, ensuring that they are working towards the same goals and objectives. It will also help to reduce confusion and ambiguity, as all key principles and commands will be clearly defined and easily accessible. Meanwhile, it's portable for every project going forward. I also see a few redundant information here , for example, the section 'Resources' and section 'Version History'. We have better places to store these kind of information. You need to have a comprehensive review to reduce this kind of redundancy or any duplication. Save tokens will help us to reduce the cost of using the model.

### Fourth round
use MCP Context7 to update task-master's status. I guess there is not 'wip' or 'finished' status for task-master, using the right status.

### Fifth round
Ask Agent system-architect, it's your turn to review and refine the PRD(@docs/prd-v2.md) and FSD(@docs/fsd-v2.md) now.

Ask Agent frontend-architect, it's your turn to review and refine the PRD(@docs/prd-v2.md) and FSD(@docs/fsd-v2.md) now

## task-master
- Use `task-master init` to initialize a new task-master project.
- Do not forget to replace `.taskmaster/config.json` with your own configuration. And do not forget to remove `.mcp.json`, we do not need a project wise configuration for task-master.s
- Use `task-master parse-prd --input=docs/prd-v2.md` to generate task lists
- Use `task-master expand --all` to expand all tasks
- The following prompts:
  - Refer to the FSD @docs/fsd-v2.md and tasks and subtasks in task-master, help to add tasks or subtasks if any thing in FSD is missing in the task list.
  - In the same way to check whether all tasks have been expand properly before we start to build.

## Run all
Agent task-orchestrator, help to orchestrate proper agents to execute tasks and subtasks in task-master until all tasks are completed. On each iteration:
  - Mark the status of each task and subtask as 'in progress' before start on the particular task/subtask;
  - And mark the status as 'completed' or 'failed' after the task/subtask is completed or failed.
  - Meanwhile, you also need to run `pnpm lint` and fix all errors before starting the next iteration.
  - A simple brief description of the task/subtask will be provided, it should be concise and clear.

>TODO: Before kick off the task-master, we need to re-preoritize the tasks and subtasks orders by the following principles(Also need to be based on their dependencies and priorities and other relevant constraints):
- Utilities and common parts first as the others will depend on them; Especially, error handling, exception handling, and logging should be prioritized.
- Always start with the easy tasks before tackling the difficult ones;
- Begin with peripheral areas before moving to the core.

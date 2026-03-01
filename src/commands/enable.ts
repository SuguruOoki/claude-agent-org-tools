import { loadConfig, saveConfig, isToolName, type ToolName } from "../config.js";

export async function runEnable(
  projectDir: string,
  toolName: string,
): Promise<void> {
  if (!isToolName(toolName)) {
    console.error(
      `Unknown tool: ${toolName}. Available: andon, topology, raci, orgMemory`,
    );
    process.exit(1);
  }

  const config = await loadConfig(projectDir);
  config.tools[toolName as ToolName].enabled = true;
  await saveConfig(projectDir, config);
  console.log(`Enabled: ${toolName}`);
}

export async function runDisable(
  projectDir: string,
  toolName: string,
): Promise<void> {
  if (!isToolName(toolName)) {
    console.error(
      `Unknown tool: ${toolName}. Available: andon, topology, raci, orgMemory`,
    );
    process.exit(1);
  }

  const config = await loadConfig(projectDir);
  config.tools[toolName as ToolName].enabled = false;
  await saveConfig(projectDir, config);
  console.log(`Disabled: ${toolName}`);
}

import { z } from 'zod';
import { tool } from 'ai';
import { spawn } from 'child_process';
import * as path from 'path';
import { ExecutionContext } from '../types/agent';
import { handleToolError, ToolResponse } from './tool-utils';

const bundleComponentSchema = z.object({
  componentPath: z.string().describe('Path to the React/Next.js component file to bundle'),
  outputName: z.string().optional().describe('Name for the output preview (defaults to component file name)')
});

export function createBundleComponentTool(context: ExecutionContext) {
  return tool({
    description: 'Bundle a React/Next.js component for preview in the Superdesign canvas (build-and-iframe approach).',
    parameters: bundleComponentSchema,
    execute: async (params): Promise<ToolResponse> => {
      try {
        const { componentPath, outputName } = params;
        const workspaceRoot = context.workingDirectory;
        
        // Get the extension path - the script is in the extension directory, not the workspace
        const extensionPath = path.dirname(path.dirname(__dirname)); // Go up from dist/tools to extension root
        const scriptPath = path.join(extensionPath, 'scripts', 'bundleComponent.js');
        
        const outDir = path.join(workspaceRoot, '.superdesign', 'design_iterations', outputName || path.parse(componentPath).name);

        console.log(`Bundle tool: extension path = ${extensionPath}`);
        console.log(`Bundle tool: script path = ${scriptPath}`);
        console.log(`Bundle tool: workspace root = ${workspaceRoot}`);
        console.log(`Bundle tool: output dir = ${outDir}`);

        return await new Promise<ToolResponse>((resolve, reject) => {
          const proc = spawn('node', [scriptPath, componentPath, outDir], { cwd: workspaceRoot });

          let stdout = '';
          let stderr = '';

          proc.stdout.on('data', (data) => { stdout += data.toString(); });
          proc.stderr.on('data', (data) => { stderr += data.toString(); });

          proc.on('close', (code) => {
            if (code === 0) {
              resolve({
                success: true,
                summary: `Component bundled successfully to ${outDir}`,
                output: stdout
              });
            } else {
              resolve(handleToolError(stderr || `Bundling failed with exit code ${code}`, 'Bundle Component Tool', 'execution'));
            }
          });
        });
      } catch (error) {
        return handleToolError(error, 'Bundle Component Tool', 'unknown');
      }
    }
  });
} 
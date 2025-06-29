import * as vscode from 'vscode';
import { tool } from 'ai';
import { z } from 'zod';

/**
 * Execution context for tool operations
 */
export interface ExecutionContext {
  workingDirectory: string;
  sessionId: string;
  outputChannel: vscode.OutputChannel;
  abortController?: AbortController;
}

/**
 * Tool parameter validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  result?: any;
  error?: string;
  metadata?: {
    duration?: number;
    filesAffected?: string[];
    outputSize?: number;
  };
}

/**
 * Tool parameter schema for validation
 */
export interface ToolParameterSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: any[];
  properties?: { [key: string]: ToolParameterSchema };
  items?: ToolParameterSchema;
}

/**
 * Tool schema definition for LLM function calling
 */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: { [key: string]: ToolParameterSchema };
    required: string[];
  };
}

/**
 * Base interface for all tools
 */
export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly schema: ToolSchema;
  
  /**
   * Execute the tool with given parameters
   */
  execute(params: any, context: ExecutionContext): Promise<ToolResult>;
  
  /**
   * Validate parameters before execution (optional)
   */
  validate?(params: any): ValidationResult;
  
  /**
   * Check if tool can be used in current context (optional)
   */
  canExecute?(context: ExecutionContext): boolean;
}

/**
 * Abstract base class for tools with common functionality
 */
export abstract class BaseTool implements Tool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly schema: ToolSchema;

  /**
   * Execute the tool - must be implemented by subclasses
   */
  abstract execute(params: any, context: ExecutionContext): Promise<ToolResult>;

  /**
   * Default validation - checks required parameters
   */
  validate(params: any): ValidationResult {
    const errors: string[] = [];
    const required = this.schema.parameters.required || [];

    for (const requiredParam of required) {
      if (!(requiredParam in params) || params[requiredParam] === undefined || params[requiredParam] === null) {
        errors.push(`Missing required parameter: ${requiredParam}`);
      }
    }

    // Validate parameter types
    for (const [paramName, paramSchema] of Object.entries(this.schema.parameters.properties)) {
      if (paramName in params) {
        const value = params[paramName];
        if (!this.validateParameterType(value, paramSchema)) {
          errors.push(`Invalid type for parameter ${paramName}: expected ${paramSchema.type}, got ${typeof value}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Default implementation - tools can be used if working directory is set
   */
  canExecute(context: ExecutionContext): boolean {
    return !!context.workingDirectory;
  }

  /**
   * Security validation - ensure paths are within SuperDesign workspace
   */
  protected validatePath(filePath: string, context: ExecutionContext): boolean {
    if (!filePath || !context.workingDirectory) {
      return false;
    }

    const path = require('path');
    const resolvedPath = path.resolve(context.workingDirectory, filePath);
    const workspacePath = path.resolve(context.workingDirectory);
    
    // Must be within workspace directory
    return resolvedPath.startsWith(workspacePath);
  }

  /**
   * Helper to validate parameter types
   */
  private validateParameterType(value: any, schema: ToolParameterSchema): boolean {
    switch (schema.type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true; // Unknown type, allow it
    }
  }

  /**
   * Helper to create standardized tool results
   */
  protected createResult(success: boolean, result?: any, error?: string, metadata?: any): ToolResult {
    return {
      success,
      result,
      error,
      metadata
    };
  }

  /**
   * Helper to log tool execution
   */
  protected log(message: string, context: ExecutionContext): void {
    context.outputChannel.appendLine(`[${this.name}] ${message}`);
  }
}

/**
 * Interface for tool registry
 */
export interface ToolRegistry {
  /**
   * Register a new tool
   */
  registerTool(tool: Tool): void;

  /**
   * Get a tool by name
   */
  getTool(name: string): Tool | undefined;

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[];

  /**
   * Get all tool schemas for LLM function calling
   */
  getAllSchemas(): ToolSchema[];

  /**
   * Get all tools in Vercel AI SDK format for LLM integration
   */
  getVercelAITools(context: ExecutionContext): { [name: string]: any };

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean;

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean;
}

/**
 * Default tool registry implementation
 */
export class DefaultToolRegistry implements ToolRegistry {
  private tools = new Map<string, Tool>();

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getAllSchemas(): ToolSchema[] {
    return this.getAllTools().map(tool => tool.schema);
  }

  getVercelAITools(context: ExecutionContext): { [name: string]: any } {
    const tools: { [name: string]: any } = {};
    
    for (const toolInstance of this.getAllTools()) {
      // Convert our ToolSchema to Vercel AI SDK tool format
      const schema = toolInstance.schema;
      
      // Convert parameter properties to Zod schema
      const zodProperties: { [key: string]: z.ZodTypeAny } = {};
      const requiredFields = schema.parameters.required || [];
      
      for (const [propName, propSchema] of Object.entries(schema.parameters.properties)) {
        const isRequired = requiredFields.includes(propName);
        zodProperties[propName] = this.convertToZodType(propSchema, isRequired);
      }
      
      tools[schema.name] = tool({
        description: schema.description,
        parameters: z.object(zodProperties),
        execute: async (params: any) => {
          // Execute the actual tool with the execution context
          const result = await toolInstance.execute(params, context);
          return result.success ? result.result : result.error;
        }
      });
    }
    
    return tools;
  }

  /**
   * Convert ToolParameterSchema to Zod type
   */
  private convertToZodType(paramSchema: ToolParameterSchema, isRequired: boolean = true): z.ZodTypeAny {
    let zodType: z.ZodTypeAny;
    
    switch (paramSchema.type) {
      case 'string':
        zodType = z.string();
        if (paramSchema.enum) {
          zodType = z.enum(paramSchema.enum as [string, ...string[]]);
        }
        break;
      case 'number':
        zodType = z.number();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      case 'array':
        if (paramSchema.items) {
          zodType = z.array(this.convertToZodType(paramSchema.items, true));
        } else {
          zodType = z.array(z.any());
        }
        break;
      case 'object':
        if (paramSchema.properties) {
          const objectProps: { [key: string]: z.ZodTypeAny } = {};
          for (const [propName, propDef] of Object.entries(paramSchema.properties)) {
            objectProps[propName] = this.convertToZodType(propDef, true);
          }
          zodType = z.object(objectProps);
        } else {
          zodType = z.object({});
        }
        break;
      default:
        zodType = z.any();
    }
    
    // Apply optional/required logic based on schema-level required array
    if (!isRequired) {
      zodType = zodType.optional();
    }
    
    return zodType.describe(paramSchema.description);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get tools by category or pattern
   */
  getToolsByPattern(pattern: RegExp): Tool[] {
    return this.getAllTools().filter(tool => pattern.test(tool.name));
  }
} 
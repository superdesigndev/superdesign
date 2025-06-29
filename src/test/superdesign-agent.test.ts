import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SuperDesignCodingAgent, AgentConfig } from '../core/agent';
import { SuperDesignToolRegistry } from '../tools/registry';

// Mock VS Code output channel for testing
const mockOutputChannel = {
  appendLine: (message: string) => console.log(`[LOG] ${message}`),
  append: (message: string) => console.log(`[LOG] ${message}`),
  clear: () => {},
  show: () => {},
  hide: () => {},
  dispose: () => {},
  name: 'Test',
  replace: () => {},
};

// Load real environment variables for LLM testing
const dotenv = require('dotenv');
dotenv.config();

// Fallback to test keys if real ones aren't available
if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test-openai-key';
}
if (!process.env.ANTHROPIC_API_KEY) {
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
}

/**
 * Helper function to create test environment and agent
 */
function createTestAgent(): { agent: SuperDesignCodingAgent; tempDir: string; cleanup: () => void } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'superdesign-agent-test-'));
  
  // Create test files
  const testFile = path.join(tempDir, 'test.txt');
  fs.writeFileSync(testFile, 'Hello, SuperDesign!');
  
  const agentConfig: AgentConfig = {
    workingDirectory: tempDir,
    outputChannel: mockOutputChannel,
    toolRegistry: new SuperDesignToolRegistry(),
    llmConfig: {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-openai-key',
      maxTokens: 1000,
      temperature: 0.7
    },
    systemPrompts: {
      default: 'You are a helpful coding assistant.',
      design: 'You are a SuperDesign agent.',
      coding: 'You are an expert developer.'
    },
    security: {
      allowedPaths: [tempDir],
      restrictToWorkspace: true
    }
  };

  const agent = new SuperDesignCodingAgent(agentConfig);

  const cleanup = () => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.log('Cleanup error (non-critical):', error);
    }
  };

  return { agent, tempDir, cleanup };
}

/**
 * Test 1: Agent Initialization
 */
async function testAgentInitialization(): Promise<boolean> {
  console.log('🧪 Testing Agent Initialization...');
  
  try {
    const { agent, cleanup } = createTestAgent();
    
    // Test basic properties
    if (!agent.isReady()) {
      console.error('❌ Agent should be ready after initialization');
      cleanup();
      return false;
    }

    if (!agent.isInitialized) {
      console.error('❌ Agent should be initialized');
      cleanup();
      return false;
    }

    const tools = agent.getAvailableTools();
    if (tools.length === 0) {
      console.error('❌ Agent should have available tools');
      cleanup();
      return false;
    }

    console.log('✅ Agent initialized successfully');
    console.log(`📦 Available tools: ${tools.join(', ')}`);
    
    cleanup();
    return true;
    
  } catch (error) {
    console.error('❌ Agent initialization failed:', error);
    return false;
  }
}

/**
 * Test 2: Working Directory Management
 */
async function testWorkingDirectory(): Promise<boolean> {
  console.log('🧪 Testing Working Directory Management...');
  
  try {
    const { agent, tempDir, cleanup } = createTestAgent();
    
    // Test getting working directory
    const workingDir = agent.getWorkingDirectory();
    if (workingDir !== tempDir) {
      console.error('❌ Working directory mismatch');
      cleanup();
      return false;
    }

    // Test setting working directory
    const newTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'superdesign-agent-test2-'));
    agent.setWorkingDirectory(newTempDir);
    
    if (agent.getWorkingDirectory() !== newTempDir) {
      console.error('❌ Working directory should be updated');
      cleanup();
      fs.rmSync(newTempDir, { recursive: true, force: true });
      return false;
    }

    console.log('✅ Working directory management works correctly');
    
    cleanup();
    fs.rmSync(newTempDir, { recursive: true, force: true });
    return true;
    
  } catch (error) {
    console.error('❌ Working directory test failed:', error);
    return false;
  }
}

/**
 * Test 3: Session Management
 */
async function testSessionManagement(): Promise<boolean> {
  console.log('🧪 Testing Session Management...');
  
  try {
    const { agent, cleanup } = createTestAgent();
    
    const sessionId = 'test-session-123';
    const projectPath = agent.getWorkingDirectory();
    
    // Test session creation
    const session = agent.getSession(sessionId, projectPath);
    if (session.id !== sessionId) {
      console.error('❌ Session ID mismatch');
      cleanup();
      return false;
    }

    if (session.projectPath !== projectPath) {
      console.error('❌ Session project path mismatch');
      cleanup();
      return false;
    }

    // Test session retrieval (should return same session)
    const session2 = agent.getSession(sessionId, projectPath);
    if (session2.id !== session.id) {
      console.error('❌ Should return same session for same ID');
      cleanup();
      return false;
    }

    console.log('✅ Session management works correctly');
    
    cleanup();
    return true;
    
  } catch (error) {
    console.error('❌ Session management test failed:', error);
    return false;
  }
}

/**
 * Test 4: Tool Registry Integration  
 */
async function testToolRegistryIntegration(): Promise<boolean> {
  console.log('🧪 Testing Tool Registry Integration...');
  
  try {
    const { agent, cleanup } = createTestAgent();
    
    const tools = agent.getAvailableTools();
    
    // Check that we have the expected tools
    const expectedTools = ['read', 'write', 'edit', 'multiedit', 'ls', 'grep', 'glob', 'bash'];
    
    for (const expectedTool of expectedTools) {
      if (!tools.includes(expectedTool)) {
        console.error(`❌ Missing expected tool: ${expectedTool}`);
        cleanup();
        return false;
      }
    }

    if (tools.length < expectedTools.length) {
      console.error('❌ Not enough tools registered');
      cleanup();
      return false;
    }

    console.log('✅ Tool registry integration works correctly');
    console.log(`📦 Found ${tools.length} tools: ${tools.join(', ')}`);
    
    cleanup();
    return true;
    
  } catch (error) {
    console.error('❌ Tool registry integration test failed:', error);
    return false;
  }
}

/**
 * Test 5: Real LLM Task Execution - Hello World File Creation
 */
async function testRealTaskExecution(): Promise<boolean> {
  console.log('🧪 Testing Real LLM Task Execution - Hello World File Creation...');
  
  // Check if we have real API keys
  const hasRealOpenAIKey = process.env.OPENAI_API_KEY && 
    process.env.OPENAI_API_KEY !== 'test-openai-key' && 
    process.env.OPENAI_API_KEY.startsWith('sk-');
  
  const hasRealAnthropicKey = process.env.ANTHROPIC_API_KEY && 
    process.env.ANTHROPIC_API_KEY !== 'test-anthropic-key' && 
    process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-');

  if (!hasRealOpenAIKey && !hasRealAnthropicKey) {
    console.log('⏭️ Skipping real LLM test - no real API keys found');
    return true; // Skip but don't fail
  }

  try {
    const { tempDir, cleanup } = createTestAgent();
    
    // Choose provider and model
    let provider = 'openai';
    let apiKey = process.env.OPENAI_API_KEY!;
    let model = 'gpt-4o-mini';
    
    if (!hasRealOpenAIKey && hasRealAnthropicKey) {
      provider = 'anthropic';
      apiKey = process.env.ANTHROPIC_API_KEY!;
      model = 'claude-3-5-haiku-20241022';
    }

    console.log(`🤖 Using ${provider} with model ${model}`);
    
    // Create agent with real API configuration
    const realAgentConfig: AgentConfig = {
      workingDirectory: tempDir,
      outputChannel: mockOutputChannel,
      toolRegistry: new SuperDesignToolRegistry(),
      llmConfig: {
        provider: provider as any,
        model: model,
        apiKey: apiKey,
        maxTokens: 1500,
        temperature: 0.1
      },
      systemPrompts: {
        default: 'You are a helpful coding assistant with access to file tools.',
        design: 'You are a SuperDesign agent that creates files using the available tools.',
        coding: 'You are an expert developer with access to file manipulation tools.'
      },
      security: {
        allowedPaths: [tempDir],
        restrictToWorkspace: true
      }
    };

    const realAgent = new SuperDesignCodingAgent(realAgentConfig);
    
    const prompt = "Create a hello.js file that prints 'Hello from SuperDesign!' to the console. Use the write tool to create this file.";
    console.log(`📝 Prompt: "${prompt}"`);
    
    // Make actual LLM call
    const startTime = Date.now();
    const result = await realAgent.executeTaskWithStreaming(prompt, {
      sessionId: 'real-test-session',
      maxTokens: 1500,
      temperature: 0.1
    });
    const duration = Date.now() - startTime;

    console.log(`⏱️ LLM call completed in ${duration}ms`);
    
    if (!result.success) {
      console.error('❌ Task execution failed:', result.error);
      cleanup();
      return false;
    }

    // Verify the file was created by LLM + tools
    const helloFilePath = path.join(tempDir, 'hello.js');
    if (!fs.existsSync(helloFilePath)) {
      console.error('❌ LLM did not create the hello.js file');
      console.log('📝 All messages:');
      result.messages.forEach((msg, i) => {
        console.log(`   ${i + 1}. ${msg.type}: ${msg.content?.substring(0, 100)}...`);
      });
      cleanup();
      return false;
    }

    // Verify file content
    const content = fs.readFileSync(helloFilePath, 'utf8');
    if (!content.includes('Hello') || !content.includes('console.log')) {
      console.error('❌ Hello world file content is incorrect:', content);
      cleanup();
      return false;
    }

    console.log('✅ Real LLM task execution successful!');
    console.log(`📁 Created file: ${helloFilePath}`);
    console.log(`📄 Content: ${content.trim()}`);
    console.log(`🛠️ Tools used: ${result.toolsUsed.join(', ')}`);
    console.log(`💰 Cost: ${result.totalCost ? '$' + result.totalCost.toFixed(4) : 'Unknown'}`);
    
    cleanup();
    return true;
    
  } catch (error) {
    console.error('❌ Real LLM task execution test failed:', error);
    return false;
  }
}

// Removed MockTaskExecutionAgent - all tests now use real LLM + tool execution

/**
 * Test 6: Real LLM Multi-Step Task - Create, Read and Execute File
 */
async function testMultiStepTask(): Promise<boolean> {
  console.log('🧪 Testing Real LLM Multi-Step Task - Create, Read and Execute File...');
  
  // Check if we have real API keys
  const hasRealOpenAIKey = process.env.OPENAI_API_KEY && 
    process.env.OPENAI_API_KEY !== 'test-openai-key' && 
    process.env.OPENAI_API_KEY.startsWith('sk-');
  
  const hasRealAnthropicKey = process.env.ANTHROPIC_API_KEY && 
    process.env.ANTHROPIC_API_KEY !== 'test-anthropic-key' && 
    process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-');

  if (!hasRealOpenAIKey && !hasRealAnthropicKey) {
    console.log('⏭️ Skipping real LLM multi-step test - no real API keys found');
    return true; // Skip but don't fail
  }

  try {
    const { tempDir, cleanup } = createTestAgent();
    
    // Choose provider and model
    let provider = 'openai';
    let apiKey = process.env.OPENAI_API_KEY!;
    let model = 'gpt-4o';
    
    if (!hasRealOpenAIKey && hasRealAnthropicKey) {
      provider = 'anthropic';
      apiKey = process.env.ANTHROPIC_API_KEY!;
      model = 'claude-3-5-haiku-20241022';
    }

    console.log(`🤖 Using ${provider} with model ${model} for multi-step task`);
    
    // Create agent with real API configuration
    const realAgentConfig: AgentConfig = {
      workingDirectory: tempDir,
      outputChannel: mockOutputChannel,
      toolRegistry: new SuperDesignToolRegistry(),
      llmConfig: {
        provider: provider as any,
        model: model,
        apiKey: apiKey,
        maxTokens: 2000, // More tokens for complex task
        temperature: 0.1
      },
      systemPrompts: {
        default: 'You are a helpful coding assistant with access to file tools.',
        design: 'You are a SuperDesign agent that creates files using the available tools.',
        coding: 'You are an expert developer with access to file manipulation tools.'
      },
      security: {
        allowedPaths: [tempDir],
        restrictToWorkspace: true
      }
    };

    const realAgent = new SuperDesignCodingAgent(realAgentConfig);
    
    // Multi-step task: Create both hello world and calculator files
    console.log('📝 Multi-Step Task: LLM creates both hello.js and calculator.js files');
    const createPrompt = `Please create two files for me:

1. Create a hello.js file with:
   - A console.log statement printing "Hello from SuperDesign LLM!"
   - A function called greetUser that takes a name parameter
   - Call the function with "Agent" as the parameter

2. Create a calculator.js file with:
   - A function called add(a, b) that returns a + b
   - A function called multiply(a, b) that returns a * b
   - Test the functions by calling add(5, 3) and multiply(4, 6)
   - Console.log the results

Use the write tool to create both files and make sure you validate if the function is running correctly.`;
    
          const createResult = await realAgent.executeTaskWithStreaming(createPrompt, {
        sessionId: 'multi-step-files',
        maxTokens: 3000,
        temperature: 0.1
      });

    console.log('👀 createResult', JSON.stringify(createResult, null, 2));
    
    if (!createResult.success) {
      console.error('❌ LLM file creation failed:', createResult.error);
      cleanup();
      return false;
    }
    console.log('👀 tempDir', tempDir);
    
    // Verify both files were created
    const helloFilePath = path.join(tempDir, 'hello.js');
    const calculatorFilePath = path.join(tempDir, 'calculator.js');
    
    if (!fs.existsSync(helloFilePath)) {
      console.error('❌ LLM did not create the hello.js file');
      cleanup();
      return false;
    }
    
    if (!fs.existsSync(calculatorFilePath)) {
      console.error('❌ LLM did not create the calculator.js file');
      cleanup();
      return false;
    }

    // Read the content of both files
    const helloFileContent = fs.readFileSync(helloFilePath, 'utf8');
    const calculatorFileContent = fs.readFileSync(calculatorFilePath, 'utf8');
    
    console.log('📄 hello.js content:');
    console.log(helloFileContent);
    console.log('📄 calculator.js content:');
    console.log(calculatorFileContent);

    console.log('✅ Multi-step file creation completed: Both files created by LLM');

    // Step 2: Ask LLM to read and verify both files
    console.log('📖 Step 2: LLM reads and verifies both file contents');
    const readPrompt = `Please read both the hello.js and calculator.js files that were just created and tell me what each contains. Use the read tool to examine both files.`;
    
    const readResult = await realAgent.executeTaskWithStreaming(readPrompt, {
      sessionId: 'multi-step-read',
      maxTokens: 2000,
      temperature: 0.1
    });
    
    if (!readResult.success) {
      console.error('❌ LLM file reading failed:', readResult.error);
      cleanup();
      return false;
    }

    console.log('✅ Step 2 completed: Files read by LLM');

    // Step 3: Ask LLM to execute both files to verify they work
    console.log('⚡ Step 3: LLM executes both files to verify they\'re valid JavaScript');
    const executePrompt = `Please execute both the hello.js and calculator.js files using the bash tool to verify they work correctly. Run "node hello.js" and "node calculator.js" to test both files.`;
    
    const executeResult = await realAgent.executeTaskWithStreaming(executePrompt, {
      sessionId: 'multi-step-execute',
      maxTokens: 2000,
      temperature: 0.1
    });
    
    if (!executeResult.success) {
      console.error('❌ LLM file execution failed:', executeResult.error);
      cleanup();
      return false;
    }

    // Verify both file contents have expected structure
    if (!helloFileContent.includes('Hello') || !helloFileContent.includes('greetUser')) {
      console.error('❌ Hello.js content doesn\'t match expected format');
      cleanup();
      return false;
    }

    if (!calculatorFileContent.includes('add') || !calculatorFileContent.includes('multiply')) {
      console.error('❌ Calculator.js content doesn\'t match expected format');
      cleanup();
      return false;
    }

    console.log('✅ Multi-step LLM task completed successfully!');
    console.log(`🛠️ Total tools used across all steps: ${[...new Set([...createResult.toolsUsed, ...readResult.toolsUsed, ...executeResult.toolsUsed])].join(', ')}`);
    console.log(`📄 Hello.js preview: ${helloFileContent.substring(0, 80)}...`);
    console.log(`📄 Calculator.js preview: ${calculatorFileContent.substring(0, 80)}...`);
    
    cleanup();
    return true;
    
  } catch (error) {
    console.error('❌ Multi-step task test failed:', error);
    return false;
  }
}

// Removed testRealLLMIntegration - functionality merged into other LLM tests

/**
 * Test 7: Codebase Analysis
 */
async function testCodebaseAnalysis(): Promise<boolean> {
  console.log('🧪 Testing Codebase Analysis...');
  
  try {
    const { agent, tempDir, cleanup } = createTestAgent();
    
    // Create a mock package.json
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'react': '^18.0.0',
        'typescript': '^4.0.0'
      },
      scripts: {
        'build': 'tsc',
        'test': 'jest'
      }
    };
    
    fs.writeFileSync(
      path.join(tempDir, 'package.json'), 
      JSON.stringify(packageJson, null, 2)
    );
    
    // Create test directory
    fs.mkdirSync(path.join(tempDir, 'test'));
    
    const analysis = await agent.analyzeCodbase(tempDir);
    
    if (analysis.projectType !== 'node') {
      console.error('❌ Should detect node project type');
      cleanup();
      return false;
    }

    if (!analysis.techStack.includes('React')) {
      console.error('❌ Should detect React in tech stack');
      cleanup();
      return false;
    }

    if (!analysis.supportsTypeScript) {
      console.error('❌ Should detect TypeScript support');
      cleanup();
      return false;
    }

    if (!analysis.hasTests) {
      console.error('❌ Should detect test directory');
      cleanup();
      return false;
    }

    console.log('✅ Codebase analysis works correctly');
    console.log(`📊 Analysis: ${analysis.projectType}, ${analysis.techStack.join(', ')}`);
    
    cleanup();
    return true;
    
  } catch (error) {
    console.error('❌ Codebase analysis test failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests(): Promise<void> {
  console.log('🚀 Running SuperDesign Agent Tests');
  console.log('=====================================\n');

  const tests = [
    { name: 'Agent Initialization', fn: testAgentInitialization },
    { name: 'Working Directory Management', fn: testWorkingDirectory },
    { name: 'Session Management', fn: testSessionManagement },
    { name: 'Tool Registry Integration', fn: testToolRegistryIntegration },
    { name: 'Real LLM + Tools - Hello World Creation', fn: testRealTaskExecution },
    { name: 'Real LLM + Tools - Multi-Step Task', fn: testMultiStepTask },
    { name: 'Codebase Analysis', fn: testCodebaseAnalysis },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`❌ Test "${test.name}" threw an error:`, error);
      failed++;
    }
    console.log(''); // Add spacing between tests
  }

  console.log('=====================================');
  console.log('🏁 Test Results Summary');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total:  ${passed + failed}`);
  
  if (failed === 0) {
    console.log('🎉 All SuperDesign Agent tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Check output above for details.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

/**
 * Run the complete test suite including streaming tests
 */
async function runCompleteTestSuite(): Promise<void> {
  console.log('🚀 Running Complete SuperDesign Agent Test Suite\n');
  
  // Run the main agent tests
  console.log('📋 Phase 1: Core Agent Tests');
  console.log('=' .repeat(50));
  await runAllTests();
  
  // Import and run streaming tests
  console.log('\n\n📋 Phase 2: Streaming Integration Tests');
  console.log('=' .repeat(50));
  
  try {
    const { runStreamingTests } = await import('./streaming-agent.test');
    await runStreamingTests();
  } catch (error) {
    console.error('❌ Failed to run streaming tests:', error);
  }
  
  console.log('\n\n🎉 Complete test suite finished!');
}

export { runAllTests, runCompleteTestSuite }; 
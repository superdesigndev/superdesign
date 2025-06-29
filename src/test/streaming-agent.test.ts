import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LLMService, LLMServiceConfig } from '../core/llm-service';
import { SuperDesignToolRegistry } from '../tools/registry';
import { ExecutionContext } from '../tools/base-tool';

// Load environment variables
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Mock VS Code output channel
const mockOutputChannel = {
  appendLine: (message: string) => console.log(`[LOG] ${message}`),
  append: (message: string) => console.log(`[LOG] ${message}`),
  clear: () => {},
  show: () => {},
  hide: () => {},
  dispose: () => {},
  name: 'StreamingTest',
  replace: () => {},
};

/**
 * Test streaming LLM service with tool integration and maxSteps
 */
async function testStreamingWithTools(): Promise<boolean> {
  console.log('🧪 Testing Streaming LLM Service with Tool Integration...');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY not found - skipping streaming tool test');
    return false;
  }

  // Create temporary directory for test files
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'streaming-test-'));
  console.log(`📁 Using temp directory: ${tempDir}`);

  try {
    // Initialize LLM service with streaming support
    const config: LLMServiceConfig = {
      provider: {
        name: 'openai',
        model: 'gpt-4o-mini', // Fast model for testing
        apiKey: apiKey,
      },
      maxTokens: 2000,
      temperature: 0.1,
      systemPrompt: 'You are a helpful coding assistant. Use tools when needed.',
    };

    const llmService = new LLMService(config, mockOutputChannel as any);
    
    // Create tool registry and execution context
    const toolRegistry = new SuperDesignToolRegistry();
    const context: ExecutionContext = {
      workingDirectory: tempDir,
      outputChannel: mockOutputChannel as any,
      sessionId: 'streaming-test'
    };

    // Get tools in Vercel AI SDK format
    const tools = toolRegistry.getVercelAITools(context);
    console.log(`🛠️ Loaded ${Object.keys(tools).length} tools: ${Object.keys(tools).join(', ')}`);

    // Test 1: Simple streaming with single tool call
    console.log('\n📝 Test 1: Single tool call with streaming...');
    const streamingResponse1 = await llmService.generateStreamingResponse([
      {
        role: 'user',
        content: 'Create a simple hello.js file that prints "Hello Streaming World!" using the write tool.',
      }
    ], {
      tools,
      maxSteps: 10
    });

    let fullContent1 = '';
    let chunkCount1 = 0;
    const startTime1 = Date.now();
    
    console.log('🌊 Streaming response (real-time):');
    console.log('─'.repeat(60));
    
    for await (const chunk of streamingResponse1.stream) {
      fullContent1 += chunk;
      chunkCount1++;
      
      // Show chunk in real-time with visual indicator
      process.stdout.write(chunk);
      
      // Add a subtle progress indicator every 10 chunks
      if (chunkCount1 % 10 === 0) {
        process.stdout.write(`[${chunkCount1}]`);
      }
    }
    
    const duration1 = Date.now() - startTime1;
    console.log('\n' + '─'.repeat(60));
    console.log(`📊 Streaming completed: ${chunkCount1} chunks, ${fullContent1.length} chars, ${duration1}ms`);
    
    // Check if tool was used and file was created
    const helloFile = path.join(tempDir, 'hello.js');
    if (!fs.existsSync(helloFile)) {
      console.log('❌ Tool was not executed - hello.js file not found');
      return false;
    }
    
    const fileContent = fs.readFileSync(helloFile, 'utf8');
    console.log(`✅ Tool executed successfully! File content: ${fileContent.trim()}`);

    // Test 2: Multi-step streaming with multiple tool calls
    console.log('\n📝 Test 2: Multi-step tool calls with streaming...');
    const streamingResponse2 = await llmService.generateStreamingResponse([
      {
        role: 'user',
        content: `Create a math.js file with add(a,b) and multiply(a,b) functions, then test it by running "node math.js". Use write tool to create and bash tool to execute.`,
      }
    ], {
      tools,
      maxSteps: 25 // Allow multiple steps
    });

    let fullContent2 = '';
    let chunkCount2 = 0;
    const startTime2 = Date.now();
    
    console.log('🌊 Multi-step streaming (real-time):');
    console.log('─'.repeat(60));
    
    for await (const chunk of streamingResponse2.stream) {
      fullContent2 += chunk;
      chunkCount2++;
      
      // Show chunk in real-time
      process.stdout.write(chunk);
      
      // Visual progress every 15 chunks for longer responses
      if (chunkCount2 % 15 === 0) {
        process.stdout.write(` •${chunkCount2}• `);
      }
    }
    
    const duration2 = Date.now() - startTime2;
    console.log('\n' + '─'.repeat(60));
    console.log(`📊 Multi-step streaming completed: ${chunkCount2} chunks, ${fullContent2.length} chars, ${duration2}ms`);
    
    // Check if both tools were used
    const mathFile = path.join(tempDir, 'math.js');
    if (!fs.existsSync(mathFile)) {
      console.log('❌ Write tool was not executed - math.js file not found');
      return false;
    }
    
    const mathContent = fs.readFileSync(mathFile, 'utf8');
    console.log(`✅ Math file created! Content preview: ${mathContent.substring(0, 100)}...`);

    // Test 3: Complex streaming workflow with file operations
    console.log('\n📝 Test 3: Complex streaming workflow...');
    const streamingResponse3 = await llmService.generateStreamingResponse([
      {
        role: 'user',
        content: `Please:
1. Read the hello.js file we created earlier
2. Create an improved version called hello-v2.js with a greeting function
3. List all .js files in the directory
4. Execute the new hello-v2.js file

Use the appropriate tools for each step.`,
      }
    ], {
      tools,
      maxSteps: 25
    });

    let fullContent3 = '';
    let chunkCount3 = 0;
    const startTime3 = Date.now();
    
    console.log('🌊 Complex workflow streaming (real-time):');
    console.log('─'.repeat(60));
    
    for await (const chunk of streamingResponse3.stream) {
      fullContent3 += chunk;
      chunkCount3++;
      
      // Show chunk in real-time
      process.stdout.write(chunk);
      
      // Visual progress indicator for complex workflow
      if (chunkCount3 % 20 === 0) {
        process.stdout.write(` ⚡${chunkCount3}⚡ `);
      }
    }
    
    const duration3 = Date.now() - startTime3;
    console.log('\n' + '─'.repeat(60));
    console.log(`📊 Complex workflow completed: ${chunkCount3} chunks, ${fullContent3.length} chars, ${duration3}ms`);
    
    // Verify the workflow was completed
    const helloV2File = path.join(tempDir, 'hello-v2.js');
    if (!fs.existsSync(helloV2File)) {
      console.log('❌ Complex workflow incomplete - hello-v2.js not found');
      return false;
    }
    
    console.log('✅ Complex streaming workflow completed successfully!');

    // Test 4: Verify all expected files were created by streaming workflow
    console.log('\n📝 Test 4: Verifying streaming workflow results...');
    
    // Check that all expected files exist
    const expectedFiles = ['hello.js', 'math.js', 'hello-v2.js'];
    let filesCreated = 0;
    
    for (const fileName of expectedFiles) {
      const filePath = path.join(tempDir, fileName);
      if (fs.existsSync(filePath)) {
        filesCreated++;
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`  ✅ ${fileName} exists (${content.length} chars)`);
      } else {
        console.log(`  ❌ ${fileName} missing`);
      }
    }
    
    if (filesCreated === expectedFiles.length) {
      console.log(`✅ All ${filesCreated} files created successfully via streaming workflow`);
    } else {
      console.log(`❌ Only ${filesCreated}/${expectedFiles.length} files created`);
      return false;
    }

    console.log('\n🎉 All streaming tool integration tests passed!');
    return true;

  } catch (error) {
    console.error('❌ Streaming tool test failed:', error);
    return false;
  } finally {
    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up temp directory: ${tempDir}`);
    } catch (cleanupError) {
      console.warn('⚠️ Failed to cleanup temp directory:', cleanupError);
    }
  }
}

/**
 * Test streaming performance and characteristics
 */
async function testStreamingPerformance(): Promise<boolean> {
  console.log('\n🧪 Testing Streaming Performance Characteristics...');
  
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ OPENAI_API_KEY not found - skipping streaming performance test');
    return false;
  }

  try {
    const config: LLMServiceConfig = {
      provider: {
        name: 'openai',
        model: 'gpt-4o-mini',
        apiKey: apiKey,
      },
      maxTokens: 500,
      temperature: 0.7,
    };

    const llmService = new LLMService(config, mockOutputChannel as any);
    
    console.log('⏱️ Starting performance test...');
    const startTime = Date.now();
    
    const streamingResponse = await llmService.generateStreamingResponse([
      {
        role: 'user',
        content: 'Write a detailed explanation of how JavaScript promises work, including examples. Make it comprehensive but clear.',
      }
    ]);

    let totalChunks = 0;
    let totalCharacters = 0;
    let firstChunkTime = 0;
    const chunkTimes: number[] = [];
    
    console.log('🌊 Performance test streaming (real-time):');
    console.log('─'.repeat(60));
    
    for await (const chunk of streamingResponse.stream) {
      const chunkTime = Date.now();
      
      if (totalChunks === 0) {
        firstChunkTime = chunkTime - startTime;
        console.log(`⚡ First chunk received in ${firstChunkTime}ms`);
        console.log('─'.repeat(60));
      }
      
      chunkTimes.push(chunkTime);
      totalChunks++;
      totalCharacters += chunk.length;
      
      // Show actual streaming content
      process.stdout.write(chunk);
      
      // Performance indicators every 25 chunks
      if (totalChunks % 25 === 0) {
        const currentRate = Math.round(totalCharacters / ((chunkTime - startTime) / 1000));
        process.stdout.write(`\n[📊 ${totalChunks} chunks, ${currentRate} chars/sec]\n`);
      }
    }
    
    console.log('\n' + '─'.repeat(60));
    
    const totalTime = Date.now() - startTime;
    const avgChunkInterval = totalChunks > 1 ? 
      (chunkTimes[chunkTimes.length - 1] - chunkTimes[0]) / (totalChunks - 1) : 0;
    
    console.log('\n📊 Streaming Performance Results:');
    console.log(`  ⏱️ Time to first chunk: ${firstChunkTime}ms`);
    console.log(`  ⏱️ Total streaming time: ${totalTime}ms`);
    console.log(`  📦 Total chunks: ${totalChunks}`);
    console.log(`  📝 Total characters: ${totalCharacters}`);
    console.log(`  📈 Characters per second: ${Math.round(totalCharacters / (totalTime / 1000))}`);
    console.log(`  ⚡ Average chunk interval: ${Math.round(avgChunkInterval)}ms`);
    
    console.log('✅ Streaming performance test completed!');
    return true;
    
  } catch (error) {
    console.error('❌ Streaming performance test failed:', error);
    return false;
  }
}

/**
 * Main test runner for streaming integration
 */
async function runStreamingTests(): Promise<void> {
  console.log('🌊 SuperDesign Streaming LLM Service Integration Test\n');
  console.log('=' .repeat(60));
  
  const results = {
    toolIntegration: false,
    performance: false,
  };
  
  try {
    results.toolIntegration = await testStreamingWithTools();
  } catch (error) {
    console.log('❌ Streaming tool integration test crashed:', error);
  }
  
  try {
    results.performance = await testStreamingPerformance();
  } catch (error) {
    console.log('❌ Streaming performance test crashed:', error);
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📋 Streaming Test Results Summary:');
  console.log(`🛠️ Tool Integration: ${results.toolIntegration ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`⚡ Performance:     ${results.performance ? '✅ PASS' : '❌ FAIL'}`);
  
  const passCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.values(results).length;
  
  console.log(`\n🎯 Overall: ${passCount}/${totalCount} streaming tests passed`);
  
  if (passCount === totalCount) {
    console.log('🎉 All streaming tests passed! Streaming + tools + maxSteps working perfectly.');
  } else {
    console.log('⚠️ Some streaming tests failed. Check implementation and API keys.');
  }
}

// Export for use in other test files
export { runStreamingTests, testStreamingWithTools, testStreamingPerformance };

// Run tests if this file is executed directly
if (require.main === module) {
  runStreamingTests().catch((error) => {
    console.error('💥 Streaming test runner crashed:', error);
    process.exit(1);
  });
} 
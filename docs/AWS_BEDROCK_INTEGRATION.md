# AWS Bedrock Integration

This document describes the AWS Bedrock integration added to SuperDesign extension.

## Overview

AWS Bedrock integration allows SuperDesign to use various AI models available through Amazon's Bedrock service, including:

- **Anthropic Claude models** (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
- **Amazon Nova models** (Nova Pro, Nova Lite, Nova Micro)
- **Meta Llama models** (Llama 3.2, Llama 3.1 variants)
- **Mistral AI models** (Mistral Large, Mistral Small, Mixtral)
- **AI21 Jamba models**
- **Cohere Command models**

## Configuration

### Prerequisites

1. AWS Account with Bedrock access
2. IAM user with appropriate Bedrock permissions
3. AWS Access Key and Secret Access Key

### Setup Instructions

1. **Configure AWS Credentials**:
    - Open Command Palette (Ctrl/Cmd + Shift + P)
    - Run "Superdesign: Configure AWS Bedrock"
    - Enter your AWS Access Key ID (starts with AKIA)
    - Enter your AWS Secret Access Key
    - Specify your preferred AWS region (default: us-east-1)

2. **Select Bedrock Model**:
    - Access model selection through SuperDesign interface
    - Choose from available Bedrock models (prefixed with provider name, e.g., `anthropic.claude-3-5-sonnet-20241022-v2:0`)

## Supported Models

### Anthropic Claude on Bedrock

- `anthropic.claude-3-5-sonnet-20241022-v2:0` (default)
- `anthropic.claude-3-5-sonnet-20240620-v1:0`
- `anthropic.claude-3-opus-20240229-v1:0`
- `anthropic.claude-3-sonnet-20240229-v1:0`
- `anthropic.claude-3-haiku-20240307-v1:0`

### Amazon Nova Models

- `amazon.nova-pro-v1:0`
- `amazon.nova-lite-v1:0`
- `amazon.nova-micro-v1:0`

### Meta Llama Models

- `meta.llama3-2-90b-instruct-v1:0`
- `meta.llama3-2-11b-instruct-v1:0`
- `meta.llama3-2-3b-instruct-v1:0`
- `meta.llama3-2-1b-instruct-v1:0`
- `meta.llama3-1-405b-instruct-v1:0`
- `meta.llama3-1-70b-instruct-v1:0`
- `meta.llama3-1-8b-instruct-v1:0`

### Mistral Models

- `mistral.mistral-large-2407-v1:0`
- `mistral.mistral-small-2402-v1:0`
- `mistral.mistral-7b-instruct-v0:2`
- `mistral.mixtral-8x7b-instruct-v0:1`

### AI21 Labs Models

- `ai21.jamba-1-5-large-v1:0`
- `ai21.jamba-1-5-mini-v1:0`

### Cohere Models

- `cohere.command-r-plus-v1:0`
- `cohere.command-r-v1:0`

## Implementation Details

### Files Modified

1. **package.json**: Added AWS Bedrock dependency and configuration settings
2. **src/services/customAgentService.ts**: Added Bedrock provider support
3. **src/providers/chatSidebarProvider.ts**: Added Bedrock models to model selector
4. **src/extension.ts**: Added AWS configuration command

### Configuration Settings

- `securedesign.awsAccessKeyId`: AWS Access Key ID
- `securedesign.awsSecretAccessKey`: AWS Secret Access Key
- `securedesign.awsRegion`: AWS region (default: us-east-1)
- `securedesign.aiModelProvider`: Set to "bedrock" for Bedrock models

### Security Considerations

- Credentials are stored securely in VS Code's configuration system
- Keys are masked in UI displays
- No credentials are logged or exposed in debug output

## Benefits

1. **Cost Efficiency**: Bedrock often offers competitive pricing compared to direct API access
2. **Model Variety**: Access to multiple AI providers through a single interface
3. **AWS Integration**: Seamless integration with existing AWS infrastructure
4. **Reliability**: Leverages AWS's robust infrastructure and SLAs

## Troubleshooting

### Common Issues

1. **Invalid Credentials**: Ensure your AWS credentials have Bedrock access permissions
2. **Region Availability**: Verify that your selected models are available in your configured region
3. **Model Access**: Some models may require special access approval through AWS console

### Error Messages

- "AWS credentials not configured": Run the AWS Bedrock configuration command
- "Invalid region format": Use format like 'us-east-1', 'eu-west-1'
- AWS authentication errors: Verify your credentials and permissions

## Next Steps

Consider implementing:

- IAM role-based authentication for enhanced security
- Model usage monitoring and cost tracking
- Support for additional Bedrock models as they become available
- Regional failover for improved reliability

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";

const LANGUAGE_IDS = {
    "c": 50,
    "cpp": 54,
    "go": 95,
    "java": 91,
    "javascript": 93,
    "python": 92,
    "ruby": 72
};

const LANGUAGE_ALIASES = {
    "c++": "cpp",
    "golang": "go",
    "js": "javascript"
};

function getLanguageId(language) {
    let l = language.toLowerCase();
    return LANGUAGE_IDS[LANGUAGE_ALIASES[l] || l] || 0;
}

function encode(str) {
    return Buffer.from(unescape(encodeURIComponent(str || ""))).toString('base64');
}

function decode(bytes) {
    const escaped = escape(Buffer.from(bytes || "", 'base64').toString());
    try {
        return decodeURIComponent(escaped);
    } catch {
        return unescape(escaped);
    }
}

// 创建 MCP 服务器实例
const server = new McpServer({
    name: "rapidapi-code-execution",
    version: "1.0.0",
});

// 定义工具的 handler 函数并保存到变量
const codeExecutionHandler = async ({ source_code, language }) => {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    const languageId = getLanguageId(language);
    if (languageId === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: `Unsupported language ${language}`,
                },
            ],
        };
    }
    const requestHeaders = {
        "x-rapidapi-key": rapidApiKey,
        "Content-Type": "application/json",
    };
    const requestData = {
        language_id: languageId,
        source_code: encode(source_code),
        redirect_stderr_to_stdout: true,
    };
    try {
        const response = await fetch(
            "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true",
            {
                method: "POST",
                headers: requestHeaders,
                body: JSON.stringify(requestData),
            }
        );
        if (!response.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Network error",
                    },
                ],
            };
        }
        const responseData = await response.json();
        const result = [decode(responseData["compile_output"]), decode(responseData["stdout"])].join("\n").trim();
        return {
            content: [
                {
                    type: "text",
                    text: result,
                },
            ],
        };
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`,
                },
            ],
        };
    }
};

// 注册工具
server.tool(
    "code_execution",
    "Run code in various programming languages",
    {
        source_code: z.string().describe("A source code snippet"),
        language: z
            .enum(["c", "cpp", "go", "java", "javascript", "python", "ruby"])
            .describe("A name of the programming language"),
    },
    codeExecutionHandler
);

// 测试代码
// if (process.env.TEST_MODE) {
//     const testInput = {
//         source_code: "print('Hello, World!')",
//         language: "python"
//     };
//     codeExecutionHandler(testInput).then(result => {
//         console.log("Test result:", JSON.stringify(result, null, 2));
//         process.exit(0);
//     }).catch(error => {
//         console.error("Test error:", error);
//         process.exit(1);
//     });
// }

// 运行服务器
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("RapidAPI Code Execution MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main:", error);
    process.exit(1);
});

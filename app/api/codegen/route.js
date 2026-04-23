export async function POST(req) {
  try {
    const {
      language = "node",
      operation = "listObjects",
      bucket = "my-bucket",
      key = "path/file.txt",
    } = await req.json();

    const snippets = {
      node: {
        listObjects: `import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";\n\nconst s3 = new S3Client({ region: "us-east-1" });\nconst data = await s3.send(new ListObjectsV2Command({ Bucket: "${bucket}", Prefix: "" }));\nconsole.log(data.Contents);`,
        download: `import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";\n\nconst s3 = new S3Client({ region: "us-east-1" });\nconst res = await s3.send(new GetObjectCommand({ Bucket: "${bucket}", Key: "${key}" }));\nconsole.log(await res.Body.transformToString());`,
        upload: `import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";\nimport { readFileSync } from "fs";\n\nconst s3 = new S3Client({ region: "us-east-1" });\nawait s3.send(new PutObjectCommand({ Bucket: "${bucket}", Key: "${key}", Body: readFileSync("./local-file") }));`,
      },
      python: {
        listObjects: `import boto3\n\ns3 = boto3.client("s3", region_name="us-east-1")\nres = s3.list_objects_v2(Bucket="${bucket}", Prefix="")\nprint(res.get("Contents", []))`,
        download: `import boto3\n\ns3 = boto3.client("s3", region_name="us-east-1")\nobj = s3.get_object(Bucket="${bucket}", Key="${key}")\nprint(obj["Body"].read().decode())`,
        upload: `import boto3\n\ns3 = boto3.client("s3", region_name="us-east-1")\ns3.upload_file("./local-file", "${bucket}", "${key}")`,
      },
      go: {
        listObjects: `cfg, _ := config.LoadDefaultConfig(context.TODO())\nclient := s3.NewFromConfig(cfg)\nout, _ := client.ListObjectsV2(context.TODO(), &s3.ListObjectsV2Input{Bucket: aws.String("${bucket}")})\nfmt.Println(out.Contents)`,
        download: `cfg, _ := config.LoadDefaultConfig(context.TODO())\nclient := s3.NewFromConfig(cfg)\nout, _ := client.GetObject(context.TODO(), &s3.GetObjectInput{Bucket: aws.String("${bucket}"), Key: aws.String("${key}")})\n// read out.Body`,
        upload: `cfg, _ := config.LoadDefaultConfig(context.TODO())\nclient := s3.NewFromConfig(cfg)\nfile, _ := os.Open("./local-file")\n_, _ = client.PutObject(context.TODO(), &s3.PutObjectInput{Bucket: aws.String("${bucket}"), Key: aws.String("${key}"), Body: file})`,
      },
    };

    const snippet = snippets[language]?.[operation];
    if (!snippet) {
      return Response.json(
        { error: "Unsupported language or operation" },
        { status: 400 },
      );
    }

    return Response.json({ success: true, language, operation, snippet });
  } catch (error) {
    return Response.json(
      { error: error.message || "Failed to generate snippet" },
      { status: 500 },
    );
  }
}

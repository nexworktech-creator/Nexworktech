import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const services = [
  ["websites", "Website development", "Business sites, e-commerce, portfolios, landing pages and dashboards."],
  ["web-apps", "Web applications", "SaaS, CRM, attendance, inventory and school management."],
  ["iot", "IoT solutions", "Smart home, agriculture, industrial and energy monitoring, GPS."],
  ["ai-automation", "AI and business automation", "Support assistants, lead handling and workflow automation."],
  ["chatbots", "Chatbot development", "WhatsApp, Instagram and website bots."],
  ["cloud", "Cloud and hosting", "Hosting, deployment, monitoring and backups."],
  ["robotics", "Robotics and Arduino", "Arduino and ESP32 projects and remote control."],
  ["training", "Student training", "Practical courses with verifiable certificates."],
];
const demos = [["smart-home", "Smart Home"], ["iot-sensors", "IoT Sensor Dashboard"], ["automation-builder", "Automation Builder"], ["website-chatbot", "Website Chatbot"]];
async function main() {
  for (const [slug, name, summary] of services)
    await prisma.service.upsert({ where: { slug }, update: {}, create: { slug, name, summary } });
  for (const [slug, title] of [["iot-basics", "Practical IoT"], ["arduino", "Arduino training"], ["esp32", "ESP32 training"], ["web-dev", "Web development"]])
    await prisma.course.upsert({ where: { slug }, update: {}, create: { slug, title, requiredAssignments: 3 } });
  for (const [slug, name] of demos)
    await prisma.demo.upsert({ where: { slug }, update: {}, create: { slug, name } });
  console.log("Seeded services, demos and courses. No sample inquiries, reviews or customers are created.");
}
main().finally(() => prisma.$disconnect());

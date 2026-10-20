import env from "../config/env.js";
import logger from "../config/logger.js";
import EmailAlertService from "../infrastructure/notifications/email-alert-service.js";

const confirmed = process.argv.includes("--send");

if (!confirmed) {
  console.error("No se envió ningún correo. Para confirmar usa: npm run alert:test -- --send");
  process.exitCode = 2;
} else if (
  !env.alertEmailEnabled ||
  !env.gmailUser ||
  !env.gmailAppPassword ||
  env.gmailAppPassword === "contraseña-de-aplicación"
) {
  console.error(
    "No se envió ningún correo. Configura ALERT_EMAIL_ENABLED=true y credenciales reales de Gmail.",
  );
  process.exitCode = 2;
} else {
  const alertService = new EmailAlertService({ logger });
  const sent = await alertService.sendSenderAlert({
    sender: {
      id: "email-test",
      displayName: "Prueba segura de alertas",
      phoneNumber: "No aplica",
    },
    status: "test",
    reason: "manual_email_test",
    message: "Este correo verifica la configuración de alertas. No corresponde a una desconexión real.",
  });

  if (!sent) {
    console.error("Gmail no confirmó el envío. Revisa el registro estructurado del servidor.");
    process.exitCode = 1;
  } else {
    console.log("Correo de prueba aceptado por Gmail.");
  }
}

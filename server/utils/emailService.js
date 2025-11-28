const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP
const createTransporter = () => {
    // Support multiple email providers
    const emailProvider = process.env.EMAIL_PROVIDER || 'gmail';
    
    let transportConfig;
    
    switch (emailProvider) {
        case 'gmail':
            transportConfig = {
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS // Use App Password for Gmail
                }
            };
            break;
        case 'outlook':
            transportConfig = {
                host: 'smtp-mail.outlook.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            };
            break;
        case 'smtp':
            transportConfig = {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            };
            break;
        default:
            // Development/test mode - use ethereal
            return nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                auth: {
                    user: process.env.EMAIL_USER || 'test@ethereal.email',
                    pass: process.env.EMAIL_PASS || 'testpass'
                }
            });
    }
    
    return nodemailer.createTransport(transportConfig);
};

// Email templates
const templates = {
    paymentReminder: (data) => ({
        subject: `⏰ Recordatorio: ${data.paymentName} vence ${data.daysText}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center; }
                    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
                    .content { padding: 32px; }
                    .payment-card { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; padding: 24px; margin: 20px 0; color: white; }
                    .payment-name { font-size: 20px; font-weight: bold; margin-bottom: 8px; }
                    .payment-amount { font-size: 32px; font-weight: bold; }
                    .payment-date { opacity: 0.9; margin-top: 8px; }
                    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
                    .info-label { color: #666; }
                    .info-value { font-weight: 600; color: #333; }
                    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
                    .footer { background-color: #f8f9fa; padding: 24px; text-align: center; color: #666; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>💰 FinanceApp</h1>
                    </div>
                    <div class="content">
                        <h2>¡Hola ${data.userName}!</h2>
                        <p>Te recordamos que tienes un pago próximo a vencer:</p>
                        
                        <div class="payment-card">
                            <div class="payment-name">${data.paymentName}</div>
                            <div class="payment-amount">${data.currency} ${data.amount.toFixed(2)}</div>
                            <div class="payment-date">📅 Vence: ${data.dueDate}</div>
                        </div>
                        
                        ${data.categoryName ? `
                        <div class="info-row">
                            <span class="info-label">Categoría</span>
                            <span class="info-value">${data.categoryName}</span>
                        </div>
                        ` : ''}
                        
                        ${data.notes ? `
                        <div class="info-row">
                            <span class="info-label">Notas</span>
                            <span class="info-value">${data.notes}</span>
                        </div>
                        ` : ''}
                        
                        <center>
                            <a href="${data.appUrl}/payments" class="button">Ver en la App</a>
                        </center>
                    </div>
                    <div class="footer">
                        <p>Este es un recordatorio automático de FinanceApp.</p>
                        <p>Puedes configurar tus preferencias de notificación en la app.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
Hola ${data.userName},

Te recordamos que tienes un pago próximo a vencer:

${data.paymentName}
Monto: ${data.currency} ${data.amount.toFixed(2)}
Fecha de vencimiento: ${data.dueDate}
${data.categoryName ? `Categoría: ${data.categoryName}` : ''}
${data.notes ? `Notas: ${data.notes}` : ''}

Ingresa a la app para más detalles: ${data.appUrl}/payments

Saludos,
FinanceApp
        `
    }),
    
    budgetAlert: (data) => ({
        subject: `⚠️ Alerta de Presupuesto: ${data.categoryName}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 32px; text-align: center; }
                    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
                    .content { padding: 32px; }
                    .alert-card { background: ${data.percentage >= 100 ? '#fee2e2' : data.percentage >= 80 ? '#fef3c7' : '#d1fae5'}; border-left: 4px solid ${data.percentage >= 100 ? '#ef4444' : data.percentage >= 80 ? '#f59e0b' : '#10b981'}; border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .alert-title { font-size: 18px; font-weight: bold; color: ${data.percentage >= 100 ? '#dc2626' : data.percentage >= 80 ? '#d97706' : '#059669'}; }
                    .progress-bar { background-color: #e5e7eb; border-radius: 9999px; height: 12px; margin: 16px 0; overflow: hidden; }
                    .progress-fill { height: 100%; border-radius: 9999px; background: ${data.percentage >= 100 ? '#ef4444' : data.percentage >= 80 ? '#f59e0b' : '#10b981'}; width: ${Math.min(data.percentage, 100)}%; }
                    .stats { display: flex; justify-content: space-between; margin-top: 16px; }
                    .stat { text-align: center; }
                    .stat-value { font-size: 20px; font-weight: bold; color: #333; }
                    .stat-label { font-size: 12px; color: #666; }
                    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
                    .footer { background-color: #f8f9fa; padding: 24px; text-align: center; color: #666; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>💰 FinanceApp</h1>
                    </div>
                    <div class="content">
                        <h2>¡Hola ${data.userName}!</h2>
                        
                        <div class="alert-card">
                            <div class="alert-title">
                                ${data.percentage >= 100 ? '🚨 ¡Presupuesto excedido!' : data.percentage >= 80 ? '⚠️ Presupuesto casi agotado' : '📊 Actualización de presupuesto'}
                            </div>
                            <p>Tu presupuesto para <strong>${data.categoryName}</strong> ha alcanzado el <strong>${data.percentage.toFixed(0)}%</strong></p>
                            
                            <div class="progress-bar">
                                <div class="progress-fill"></div>
                            </div>
                            
                            <div class="stats">
                                <div class="stat">
                                    <div class="stat-value">${data.currency} ${data.spent.toFixed(2)}</div>
                                    <div class="stat-label">Gastado</div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value">${data.currency} ${data.budget.toFixed(2)}</div>
                                    <div class="stat-label">Presupuesto</div>
                                </div>
                                <div class="stat">
                                    <div class="stat-value">${data.currency} ${Math.max(0, data.budget - data.spent).toFixed(2)}</div>
                                    <div class="stat-label">Disponible</div>
                                </div>
                            </div>
                        </div>
                        
                        <center>
                            <a href="${data.appUrl}/budgets" class="button">Ver Presupuesto</a>
                        </center>
                    </div>
                    <div class="footer">
                        <p>Este es un recordatorio automático de FinanceApp.</p>
                        <p>Puedes configurar tus preferencias de notificación en la app.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
Hola ${data.userName},

${data.percentage >= 100 ? '¡Tu presupuesto ha sido excedido!' : data.percentage >= 80 ? 'Tu presupuesto está casi agotado' : 'Actualización de presupuesto'}

Categoría: ${data.categoryName}
Gastado: ${data.currency} ${data.spent.toFixed(2)}
Presupuesto: ${data.currency} ${data.budget.toFixed(2)}
Porcentaje usado: ${data.percentage.toFixed(0)}%

Ingresa a la app para más detalles: ${data.appUrl}/budgets

Saludos,
FinanceApp
        `
    }),
    
    weeklyReport: (data) => ({
        subject: `📊 Tu Resumen Semanal - FinanceApp`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center; }
                    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
                    .content { padding: 32px; }
                    .summary-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; }
                    .summary-card { background: #f8f9fa; border-radius: 12px; padding: 20px; text-align: center; }
                    .card-income { border-left: 4px solid #10b981; }
                    .card-expense { border-left: 4px solid #ef4444; }
                    .card-balance { border-left: 4px solid #3b82f6; }
                    .card-savings { border-left: 4px solid #8b5cf6; }
                    .card-value { font-size: 24px; font-weight: bold; }
                    .card-value.income { color: #10b981; }
                    .card-value.expense { color: #ef4444; }
                    .card-value.balance { color: #3b82f6; }
                    .card-value.savings { color: #8b5cf6; }
                    .card-label { font-size: 14px; color: #666; margin-top: 4px; }
                    .category-list { margin: 20px 0; }
                    .category-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
                    .category-name { display: flex; align-items: center; gap: 8px; }
                    .category-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; }
                    .category-amount { font-weight: 600; }
                    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
                    .footer { background-color: #f8f9fa; padding: 24px; text-align: center; color: #666; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>📊 Resumen Semanal</h1>
                    </div>
                    <div class="content">
                        <h2>¡Hola ${data.userName}!</h2>
                        <p>Aquí está tu resumen financiero de la semana del ${data.weekStart} al ${data.weekEnd}:</p>
                        
                        <div class="summary-cards">
                            <div class="summary-card card-income">
                                <div class="card-value income">${data.currency} ${data.income.toFixed(2)}</div>
                                <div class="card-label">Ingresos</div>
                            </div>
                            <div class="summary-card card-expense">
                                <div class="card-value expense">${data.currency} ${data.expenses.toFixed(2)}</div>
                                <div class="card-label">Gastos</div>
                            </div>
                            <div class="summary-card card-balance">
                                <div class="card-value balance">${data.currency} ${data.balance.toFixed(2)}</div>
                                <div class="card-label">Balance</div>
                            </div>
                            <div class="summary-card card-savings">
                                <div class="card-value savings">${data.savingsRate.toFixed(0)}%</div>
                                <div class="card-label">Tasa de Ahorro</div>
                            </div>
                        </div>
                        
                        ${data.topCategories && data.topCategories.length > 0 ? `
                        <h3>Top Categorías de Gasto</h3>
                        <div class="category-list">
                            ${data.topCategories.map(cat => `
                            <div class="category-item">
                                <span class="category-name">
                                    <span class="category-icon" style="background-color: ${cat.color}">${cat.icon}</span>
                                    ${cat.name}
                                </span>
                                <span class="category-amount">${data.currency} ${cat.amount.toFixed(2)}</span>
                            </div>
                            `).join('')}
                        </div>
                        ` : ''}
                        
                        <center>
                            <a href="${data.appUrl}/analytics" class="button">Ver Análisis Completo</a>
                        </center>
                    </div>
                    <div class="footer">
                        <p>Este es un resumen automático de FinanceApp.</p>
                        <p>Puedes configurar tus preferencias de notificación en la app.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
Hola ${data.userName},

Tu resumen semanal (${data.weekStart} - ${data.weekEnd}):

Ingresos: ${data.currency} ${data.income.toFixed(2)}
Gastos: ${data.currency} ${data.expenses.toFixed(2)}
Balance: ${data.currency} ${data.balance.toFixed(2)}
Tasa de Ahorro: ${data.savingsRate.toFixed(0)}%

${data.topCategories && data.topCategories.length > 0 ? `
Top Categorías de Gasto:
${data.topCategories.map(cat => `- ${cat.name}: ${data.currency} ${cat.amount.toFixed(2)}`).join('\n')}
` : ''}

Ingresa a la app para más detalles: ${data.appUrl}/analytics

Saludos,
FinanceApp
        `
    }),
    
    transactionAlert: (data) => ({
        subject: `💳 Nueva Transacción: ${data.description}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center; }
                    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
                    .content { padding: 32px; }
                    .transaction-card { background: ${data.type === 'income' ? '#d1fae5' : '#fee2e2'}; border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center; }
                    .transaction-amount { font-size: 36px; font-weight: bold; color: ${data.type === 'income' ? '#059669' : '#dc2626'}; }
                    .transaction-type { font-size: 14px; color: #666; margin-top: 8px; }
                    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
                    .info-label { color: #666; }
                    .info-value { font-weight: 600; color: #333; }
                    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
                    .footer { background-color: #f8f9fa; padding: 24px; text-align: center; color: #666; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>💰 FinanceApp</h1>
                    </div>
                    <div class="content">
                        <h2>Nueva Transacción Registrada</h2>
                        
                        <div class="transaction-card">
                            <div class="transaction-amount">${data.type === 'income' ? '+' : '-'}${data.currency} ${data.amount.toFixed(2)}</div>
                            <div class="transaction-type">${data.type === 'income' ? 'Ingreso' : 'Gasto'}</div>
                        </div>
                        
                        <div class="info-row">
                            <span class="info-label">Descripción</span>
                            <span class="info-value">${data.description}</span>
                        </div>
                        
                        <div class="info-row">
                            <span class="info-label">Categoría</span>
                            <span class="info-value">${data.categoryName}</span>
                        </div>
                        
                        <div class="info-row">
                            <span class="info-label">Fecha</span>
                            <span class="info-value">${data.date}</span>
                        </div>
                        
                        <center>
                            <a href="${data.appUrl}/transactions" class="button">Ver Transacciones</a>
                        </center>
                    </div>
                    <div class="footer">
                        <p>Este es un recordatorio automático de FinanceApp.</p>
                        <p>Puedes configurar tus preferencias de notificación en la app.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
Nueva Transacción Registrada

${data.type === 'income' ? 'Ingreso' : 'Gasto'}: ${data.currency} ${data.amount.toFixed(2)}
Descripción: ${data.description}
Categoría: ${data.categoryName}
Fecha: ${data.date}

Ingresa a la app para más detalles: ${data.appUrl}/transactions

Saludos,
FinanceApp
        `
    }),
    
    paymentOverdue: (data) => ({
        subject: `🚨 Pago Vencido: ${data.paymentName}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
                    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 32px; text-align: center; }
                    .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
                    .content { padding: 32px; }
                    .alert-card { background: #fee2e2; border: 2px solid #ef4444; border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center; }
                    .alert-icon { font-size: 48px; margin-bottom: 16px; }
                    .payment-name { font-size: 20px; font-weight: bold; color: #dc2626; }
                    .payment-amount { font-size: 32px; font-weight: bold; color: #991b1b; margin: 12px 0; }
                    .overdue-days { background: #dc2626; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-size: 14px; }
                    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #eee; }
                    .info-label { color: #666; }
                    .info-value { font-weight: 600; color: #333; }
                    .button { display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 20px; }
                    .footer { background-color: #f8f9fa; padding: 24px; text-align: center; color: #666; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚨 Pago Vencido</h1>
                    </div>
                    <div class="content">
                        <h2>¡Atención ${data.userName}!</h2>
                        
                        <div class="alert-card">
                            <div class="alert-icon">⚠️</div>
                            <div class="payment-name">${data.paymentName}</div>
                            <div class="payment-amount">${data.currency} ${data.amount.toFixed(2)}</div>
                            <div class="overdue-days">Vencido hace ${data.daysOverdue} día${data.daysOverdue > 1 ? 's' : ''}</div>
                        </div>
                        
                        <div class="info-row">
                            <span class="info-label">Fecha de Vencimiento</span>
                            <span class="info-value">${data.dueDate}</span>
                        </div>
                        
                        ${data.categoryName ? `
                        <div class="info-row">
                            <span class="info-label">Categoría</span>
                            <span class="info-value">${data.categoryName}</span>
                        </div>
                        ` : ''}
                        
                        <center>
                            <a href="${data.appUrl}/payments" class="button">Marcar como Pagado</a>
                        </center>
                    </div>
                    <div class="footer">
                        <p>Este es un recordatorio automático de FinanceApp.</p>
                        <p>Puedes configurar tus preferencias de notificación en la app.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
¡Atención ${data.userName}!

Tu pago "${data.paymentName}" está vencido.

Monto: ${data.currency} ${data.amount.toFixed(2)}
Fecha de Vencimiento: ${data.dueDate}
Días de retraso: ${data.daysOverdue}
${data.categoryName ? `Categoría: ${data.categoryName}` : ''}

Ingresa a la app para marcar como pagado: ${data.appUrl}/payments

Saludos,
FinanceApp
        `
    })
};

// Send email function
async function sendEmail(to, templateName, data) {
    try {
        // Check if email service is configured
        if (!process.env.EMAIL_USER && process.env.NODE_ENV === 'production') {
            console.log('Email service not configured, skipping email send');
            return { success: false, reason: 'Email service not configured' };
        }
        
        const transporter = createTransporter();
        const template = templates[templateName];
        
        if (!template) {
            throw new Error(`Email template "${templateName}" not found`);
        }
        
        const emailContent = template(data);
        
        const mailOptions = {
            from: `"FinanceApp" <${process.env.EMAIL_USER || 'noreply@financeapp.com'}>`,
            to,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error: error.message };
    }
}

// Send bulk emails
async function sendBulkEmails(recipients, templateName, dataGenerator) {
    const results = [];
    
    for (const recipient of recipients) {
        const data = typeof dataGenerator === 'function' ? dataGenerator(recipient) : dataGenerator;
        const result = await sendEmail(recipient.email, templateName, data);
        results.push({ email: recipient.email, ...result });
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
}

module.exports = {
    sendEmail,
    sendBulkEmails,
    templates
};


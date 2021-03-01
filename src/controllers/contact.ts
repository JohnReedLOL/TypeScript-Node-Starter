import nodemailer from "nodemailer";
import { Request, Response } from "express";
import { check, validationResult } from "express-validator";

const transporter = nodemailer.createTransport({
    service: "SendGrid",
    auth: {
        // user: process.env.SENDGRID_USER,
        user: process.env["SENDGRID_USER"],
        // pass: process.env.SENDGRID_PASSWORD
        pass: process.env["SENDGRID_PASSWORD"]
    }
});

/**
 * GET /contact
 * Contact form page.
 */
export const getContact = (req: Request, res: Response) => {
    res.render("contact", {
        title: "Contact The Developer"
    });
};

/**
 * POST /contact
 * Send a contact form via Nodemailer.
 */
export const postContact = async (req: Request, res: Response) => {
    await check("name", "Name cannot be blank").not().isEmpty().run(req);
    await check("email", "Email is not valid").isEmail().run(req);
    await check("message", "Message cannot be blank").not().isEmpty().run(req);

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        req.flash("errors", errors.array());
        return res.redirect("/contact");
    }

    const mailOptions = {
        to: "JohnMichaelReedFAS@gmail.com",
        from: `${req.body.name} <${req.body.email.toLowerCase()}>`,
        subject: "Sea Air Towers Contact",
        text: req.body.message
    };

    transporter.sendMail(mailOptions, (err) => {
        if (err) {
            const message = err.message + ". username: " + process.env["SENDGRID_USER"]
            req.flash("errors", { msg: message });
            return res.redirect("/contact");
        }
        req.flash("success", { msg: "Email has been sent successfully!" });
        res.redirect("/contact");
    });
};

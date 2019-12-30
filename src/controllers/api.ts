"use strict";

import { Response, Request, NextFunction } from "express";
import { LandlordDocument } from "../models/Landlord";


/**
 * GET /api
 * List of API examples.
 */
export const getApi = (req: Request, res: Response) => {
    res.render("api/index", {
        title: "API Examples"
    });
};

import log from 'loglevel';

import { invokeAcusite, saveAcusiteResponse } from './acusite/index.mjs';
import { getClient } from './client/index.mjs';
import {
  invokeSageMakerRequests,
  saveSageMakerResponse,
} from './sagemaker/index.mjs';
import { createSurveyFromBody, saveSurveyResponse } from './survey/index.mjs';
import { createJsonResponse } from './utils/index.mjs';

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
export const handler = async (event, _context) => {
  log.setLevel(process.env.LOG_LEVEL);

  let clientId;
  const createdDateTime = new Date().toISOString(); // this is the date the survey was created...it is part of the primary key for the table

  try {
    log.info('event', event);
    const survey = createSurveyFromBody(event.body);
    clientId = survey.client_id;
    log.info('survey', survey);

    try {
      await saveSurveyResponse(survey, createdDateTime);
    } catch (error) {
      log.error('Error saving survey response', error);
      throw error;
    }

    let client;
    try {
      client = await getClient(survey.client_id);
    } catch (error) {
      log.error('Error retrieving client', error);
      throw error;
    }

    let acusiteResponse;
    try {
      acusiteResponse = await invokeAcusite(client, survey);
      log.info('acusiteResponse', acusiteResponse);

      if (acusiteResponse.error) {
        throw new Error(acusiteResponse);
      }
    } catch (error) {
      log.error('Error invoking Acusite', error);
      throw error;
    }

    try {
      await saveAcusiteResponse(
        acusiteResponse,
        survey.client_id,
        createdDateTime,
      );
    } catch (error) {
      log.error('Error saving Acusite response', error);
      throw error;
    }

    let sagemakerResponse;
    try {
      sagemakerResponse = await invokeSageMakerRequests(
        acusiteResponse,
        survey,
      );
    } catch (error) {
      log.error('Error invoking SageMaker', error);
      throw error;
    }

    try {
      await saveSageMakerResponse(
        survey.client_id,
        createdDateTime,
        sagemakerResponse.healthScoring?.body || {},
        sagemakerResponse.ltcScoring?.body || {},
      );
    } catch (error) {
      log.error('Error saving SageMaker response', error);
      throw error;
    }

    // TODO alert advisor of client survey completion

    return createJsonResponse(200, survey);
  } catch (error) {
    // TODO alert advisor of client survey error

    const message = `Survey submission failed for client_id ${clientId}`;
    log.error(message, error);
    return createJsonResponse(500, message);
  }
};

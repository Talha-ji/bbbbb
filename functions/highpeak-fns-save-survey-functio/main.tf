provider "aws" {
  region = "us-east-1"
}

resource "aws_lambda_function" "highpeak_fns_save_survey_function" {
  architectures = []
  function_name = "highpeak-fns-save-survey-function"
  handler       = "src/index.handler"
  memory_size   = 128
  runtime       = "nodejs20.x"
  role          = "arn:aws:iam::418272792655:role/LambdaExecutionRole"
  timeout       = 120

  layers = [
    "arn:aws:lambda:us-east-1:418272792655:layer:highpeak-nodejs-layer:5",
    "arn:aws:lambda:us-east-1:580247275435:layer:LambdaInsightsExtension:52"
  ]

  environment {
    variables = {
      ENVIRONMENT_SUFFIX             = "-dev"  # TODO this will need to chagne per environment until the lambda names are fixed to remove the unnecessary suffixes
      LOG_LEVEL                      = "error" # valid values per https://www.npmjs.com/package/loglevel:  trace | debug | info | warn | error | silent
      SAGEMAKER_ENDPOINT_NAME_HEALTH = "foresite-mvp-mc"
      SAGEMAKER_ENDPOINT_NAME_LTC    = "foresite-mvp-ltc-act"
    }
  }
}

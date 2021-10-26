const core = window._quartoCoreLib;
const yamlValidators = {};
const validatorQueues = {};

function getValidator(context)
{
  const {
    schema,     // schema of yaml object
    schemaName, // name of schema so we can look it up on the validator cache
  } = context;

  if (yamlValidators[schemaName]) {
    return yamlValidators[schemaName];
  }

  const validator = new core.YAMLSchema(schema);

  yamlValidators[schemaName] = validator;
  return validator;
}

export async function withValidator(context, fun)
{
  const {
    schemaName, // name of schema so we can look it up on the validator cache
  } = context;

  if (validatorQueues[schemaName] === undefined) {
    validatorQueues[schemaName] = new core.PromiseQueue();
  }
  const queue = validatorQueues[schemaName];
   
  return await queue.enqueue(async () => {
    const validator = getValidator(context);
    try {
      return await fun(validator);
    } finally {
      return undefined;
    }
  });
}

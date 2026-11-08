import prices from '../../api/prices.js'

export default async function handler(req, res) {
  return prices(req, res)
}

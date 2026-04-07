import requests
from bs4 import BeautifulSoup

def get_og_image(url: str) -> str | None:
    """
    Fetches the given URL and returns the og:image content link if found.
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Find the meta tag with property="og:image"
        meta_tag = soup.find("meta", property="og:image")

        if meta_tag and meta_tag.get("content"):
            return meta_tag["content"]

        return None

    except requests.RequestException as e:
        print(f"Error fetching URL: {e}")
        return None


# Example usage
if __name__ == "__main__":
    url = "https://www.slideteam.net/vendor-evaluation-audit-report-summary.html"
    og_image = get_og_image(url)
    print("OG Image URL:", og_image.replace('01','{index}'))


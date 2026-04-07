import requests

PROMPT = '''
You are a marketing copywriter for SlideTeam, a presentation template company. Create a compelling conclusion section title for a blog post.

The title should follow these patterns:
- Action-oriented and inspirational
- 10 words or fewer
- Emphasizes achieving success or transformation
- Often includes "with SlideTeam" at the end
- Uses powerful verbs like: Kickstart, Deliver, Strike, Set, Win, Transform, Master, Achieve, Elevate, etc.
- Conveys the outcome or benefit related to the topic

Examples of the style:
- "Kickstart Event Planning the Right Way"
- "Governance Made Visible with SlideTeam"
- "Use SlideTeam's Templates for Creative Growth Blueprints"
- "Deliver High-quality Software with SlideTeam"
- "Strike Gold in a High-Value Industry with SlideTeam"
- "Set Targets and Win Big with SlideTeam"

Topic/Keyword: {keyword}

Generate one compelling conclusion title that matches this style and incorporates the topic.

Now give title without any formatting:'''

def main(blog):
    keyword = blog['keyword']
    response = requests.post('http://127.0.0.1:2100/openai/gpt-4o-mini', json={'prompt':PROMPT.replace('{keyword}',keyword)})
    title = (response.json())['response']
    blog['main']['conclusion']['title'] = title
    return blog
